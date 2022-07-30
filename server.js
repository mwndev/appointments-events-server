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

connectDB()

const PORT = process.env.EXPRESS_PORT

app.use(cors())
app.use(express.json())
 

process.stdin.on('data', data => {
    console.log(`this program does not take in shell arguments.`)
})





app.listen(PORT, () => {
    console.log(`listening on port ${PORT}`)
})


//for booking an appointment
const Appointment = require('./config/models/appointmentModel')
//uses dd-mm-yyyy format

//DO A STARTTIMER FUNCTION THAT DELETES APPOINTMENTS THAT ARE IN THE PAST CHECKING EVERY HOUR
const deleteOldAppointments = async() => {
    //set find to delete later

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

        allAppointments.map((item, index) =>  toSend[item._id] = item   )

        console.log(allAppointments)
        //['62b5da34091aabdeb4ab47e0']




        res.status(200).json(allAppointments)

    } catch (error) {
        console.log(error)
    }




})

app.get('/appointment/test', async (req, res) => {
    try {
        console.log(req.body)
        const mongoRes = await Appointment.find()
        console.log(mongoRes)
        res.status(200).json(mongoRes)
    } catch (error) {
        console.log(error)
        res.status(400).json({message: 'Server request failed'})
    }
    
})

app.post('/appointment/test', async (req, res) => {
    try {
        console.log(req.body)
        //set password check later
        if(req.body.passWord === true) return
        const mongoRes = await Appoint.createMany(req.body.appointsArray)

        res.status(200).json(mongoRes)
    } catch (error) {
        console.log(error)
        res.status(400).json({message: 'Server request failed'})
    }
})

app.delete('/appointment/test', async (req, res) => {
    try {
        const mongoRes = await Appoint.deleteMany({_id: { $in: req.body.idArray}})

    } catch (error) {
        console.log(error)
        res.status(400).json({message: 'Server request failed'})
    }
})

app.put('appointment/test', async (req, res) => {
    try {
            const mongoRes = await Appoint.updateMany({ 
            _id: { $in: req.body.idArray},
        }, {
            reservation: {
                email: req.body.email,
                isTaken: req.body.isTaken,
            }
            }
            )
        
    } catch (error) {
        console.log(error)
        res.status(400).json({message: 'Server request failed'})
    }
}
)













app.delete('/donoootredeeemdecaaard', async(req, res) => {
    try {
        const mongoRes = Appointment.deleteMany()
        res.status(200).json({mongoRes})
    } catch (error) {
        console.log(error)
    }

})