require('dotenv').config()
const express = require('express')
const app = express()
const cors = require('cors')
const pool = require('./pgdb')
const Redis = require('redis')
const passport = require('passport')
const mongoose = require('mongoose')
const connectDB = require('./config/mongodb')
const {Temporal} = require('@js-temporal/polyfill')


//!TODO date.dateAsNum seems to be broken

//for booking an appointment
//uses dd-mm-yyyy format
const Appointment = require('./config/models/appointmentModel')
const SessionType = require('./config/models/sessionTypeModel')
const User = require('./config/models/userModel')
const Problem = require('./config/models/serverProblemsModel')
const { use } = require('passport')

connectDB()

const PORT = process.env.EXPRESS_PORT

app.use(cors())
app.use(express.json())
 

process.stdin.on('data', data => {
    console.log(`this program does not take in shell arguments.`)
})

//session type ids
let sTIDs

const updateSessionTypes = async () => {
    sessionTypeArray = await SessionType.find()

    let idArray = []
    sessionTypeArray.map(item => idArray.push(item._id))

    sTIDs = idArray
}




app.listen(PORT, () => {
    console.log(`listening on port ${PORT}`)
})


const deleteOldAppointments = async() => {

    const now = Temporal.Now.plainDateISO()

    const nowDateAsNum = now.year * 10000 + now.month * 100 + now.day
    const mongoRes = await Appointment.deleteMany({
            "appointment.date.dateAsNum": {
                $lt: nowDateAsNum
            },
    })
   console.log(mongoRes)


}
deleteOldAppointments()
try {
    setInterval(() => {
        deleteOldAppointments()
    }, 1000 * 60 * 60)// === one hour

} catch (error) {
    console.log(error)
}


app.get('/appointment', async (req, res) => {
    try {
        const appointments = await Appointment.find()
        res.status(200).json(appointments)

    } catch (error) {
        console.log(error)
    }
})
app.put('/appointment/user', async (req, res) => {
    try {
        const b = req.body

        const appointmentExists = await Appointment.exists({_id: b.appointment._id})

        console.log(selectedAppointment._id)

        const sTExists = await SessionType.exists({_id: b.sessionType._id})
        

        console.log(selectedSessionType)

        const userExists = await User.exists(b.user._id)
        const user = await User.findById(b.user._id)
        

        if(selectedAppointment === []){
            res.status(404).json({message: 'appointment does not exist'})
            return
        }

        const updatedAppointment = await Appointment.updateOne({id: selectedAppointment._id}, {
            "appointment.reservation.numOfGuests": b.sessionType,
            "appointment.reservation.price": b.sessionType.price,
            "appointment.reservation.user": b.user.email,
            "appointment.reservation.sessionType": b.sessionType._id,
            "appointment.reservation.userNotes": b.notes,
        })
        console.log(updatedAppointment)


    } catch (error) {
        console.log(error)
        res.status(400).json({error: error})
    }
})



app.post('/appointment/admin', async (req, res) => {
    try {
        console.log(req.body)
        const startDate = Temporal.PlainDate.from({
            year: req.body.startDate.year,
            month: req.body.startDate.month,
            day: req.body.startDate.day,
        })
        const endDate = Temporal.PlainDate.from({
            year: req.body.endDate.year,
            month: req.body.endDate.month,
            day: req.body.endDate.day,
        })
        let dateToAdd
        let appointmentsArr = []
        let daNum
        for(let i = 0 ; i < startDate.until(endDate).days; i +=1 ){
            
            dateToAdd = startDate.add({days: i})
            console.log(startDate)
            //onDaysOfWeek === [true, false, true, true, true, false, false] for eack weekday
            if(req.body.onDaysOfWeek[dateToAdd.dayOfWeek - 1] === true)


            daNum = Number(dateToAdd.year * 10000) + Number(dateToAdd.month * 100) + Number(dateToAdd.day)
            console.log(daNum)

            appointmentsArr.push({
                appointment: {
                    date: {
                        year: dateToAdd.year,
                        month: dateToAdd.month,
                        day: dateToAdd.day,
                        dayOfWeek: dateToAdd.dayOfWeek,
                        dateAsString: dateToAdd.toString(),
                        dateAsNum: daNum
                    },
                    period:{
                        start: req.body.period.startTime,
                        end: req.body.period.endTime,
                    },
                    //reservation: {} is set in different put
                }
                
            })
        }
        const mongoRes = await Appointment.insertMany(appointmentsArr)
        res.status(200).json(mongoRes)
    } catch (err) {
        console.log(err)
        
    }
    
})

app.delete('/appointment/admin', async(req, res) => {
    //req.body.appointment is an object like in the post request
    console.log(req.body)
    
    try {
        console.log(`req.body is`)
        console.log(req.body)
        const mongoRes = await Appointment.deleteMany({
            "appointment.date.dateAsNum": { 
                $gte: req.body.startDate.dateAsNum,
                $lte: req.body.endDate.dateAsNum,
            },
            "appointment.date.dayOfWeek": {
                $in: acceptableDaysOfWeek(req.body.onDaysOfWeek)
            }, 
            "appointment.period.start": {$gte: req.body.period.startTime},
            "appointment.period.end": { $lte: req.body.period.endTime},
        })
        console.log(mongoRes)
        
        res.status(200).json({mongoRes})
    } catch (error) {
        console.log(error.message)
    }
})

app.delete('/appointment/admin/byid', async (req, res) => {
    try {
        console.log(req.body.objectIDArray)
        
        const mongoRes = await Appointment.deleteMany({_id: { $in: req.body.objectIDArray }})
        console.log(mongoRes)
        res.status(200).json({mongoRes})
    } catch (error) {
        console.log(error)
    }
})



app.put('/appointment/:id', async (req, res) => {
    console.log(req.body)
    console.log(req.params.id)
    try {
        const existingBooking = await Appointment.findById(req.params.id)
        if (!existingBooking) {
            res.status(400).json({ message: 'booking does not exist' })
        }
        const updatedBooking = await Appointment.updateOne({id: req.params.id}, {
            appointment: req.body.appointment
        })

        res.status(200).json(updatedBooking)
        
    } catch (error) {
        console.log(error)
    }
})


const acceptableDaysOfWeek = (arr) => {
    let toReturn = []
    for(let a = 0 ; a < arr.length ; a +=1 ) {
        if(arr[a] === true){
            toReturn.push(a + 1)
        }
    }
    return toReturn
}

//the GET request is written as a post request because get requests can't have a body
//! GET REQUEST
app.post('/appointment/admin/get', async (req, res) => {
    try {
        const aD = acceptableDaysOfWeek(req.body.onDaysOfWeek)
        console.log(req.body)



        const allAppointments = await Appointment.find({
                     
            "appointment.date.dayOfWeek": {
                $in: aD
            },
            "appointment.date.dateAsNum": {
                $gte: req.body.startDate.asNum,
                $lte: req.body.endDate.asNum,
            },
            "appointment.period.start": {
                $gte: req.body.period.startTime
            },
            "appointment.period.end": {
                $lte: req.body.period.endTime
            }
        })

        let toSend = {}

        allAppointments.map((item, index) =>  toSend[item._id] = item)

        res.status(200).json(allAppointments)

    } catch (error) {
        console.log(error)
    }




})

app.get('/sessiontypes', async (req, res) => {
    try {

        const allSessionTypes = await SessionType.find()

        res.status(200).json(allSessionTypes)

    } catch (error) {
        console.log(error)
    }
})

app.post('/sessiontypes', async (req, res) => {
    try {
        console.log(req.body)

        const newType = req.body

        const mongoRes = await SessionType.create(newType)

        res.status(200).json({mongoRes})

        updateSessionTypes()
    } catch (error) {
        res.status(400).json({error: error})
        console.log(error)
    }
})

//deletes by id
app.delete('/sessiontypes', async(req, res) => {
    try {
        console.log(req.body)

        const mongoRes = await SessionType.deleteOne({_id: req.body.id})

        res.status(200).json({mongoRes})

        updateSessionTypes()
    } catch (error) {
        res.status(400).json({error: error})
        console.log(error)

    }
})

const emailIsAvailable = async(email) => {
    try {
        const check = await User.find({email: email})
        if(check.length < 1) return true

        else return false

    } catch (error) {
        console.log(error)
    }
}

app.post('/register', async(req, res) => {
    try {
        console.log(req.body)

        if(!emailIsAvailable){
            res.status(200).json({emailIsTaken: true})
            return
        }

        //send confirmation email to email adress via server, if account is not confirmed after 1 day delete account and email
        //TODO do regex validation here too

        const mongoRes = await User.create({
            email: req.body.email,
            password: req.body.password,
            firstName: req.body.firstName,
            lastName: req.body.lastName,

        })

        res.status(200).json({mongoRes})

        updateSessionTypes()
    } catch (error) {
        res.status(400).json({error: error})
        console.log(error)

    }
})


app.post('/login', async(req, res) => {
    try {
        console.log(req.body)

        //TODO encrypt
        const user = await User.findOne({email: req.body.email, password: req.body.password})

        if(user === null){
            res.status(400).json({authenticated: false})
            return
        }

        


        
        res.status(200).json({authenticated: true, userData: user._id})

        updateSessionTypes()
    } catch (error) {
        res.status(400).json({error: error})
        console.log(error)

    }
})
