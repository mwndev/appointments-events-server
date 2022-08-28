require('dotenv').config()
const express = require('express')
const app = express()
const cors = require('cors')
const pool = require('./pgdb')
const Redis = require('redis')
const bcrypt = require('bcrypt')
const mongoose = require('mongoose')
const connectDB = require('./config/mongodb')
const {Temporal, toTemporalInstant} = require('@js-temporal/polyfill')
//HTTPS
//FINISH OTHER PAGES
//USER DASHBOARD
//CLEANUP
//add admin verification



//!TODO date.dateAsNum seems to be broken

//for booking an appointment
//uses dd-mm-yyyy format
const Appointment = require('./config/models/appointmentModel')
const SessionType = require('./config/models/sessionTypeModel')
const User = require('./config/models/userModel')
const Token = require('./config/models/tokenModel')
const Problem = require('./config/models/serverProblemsModel')
const { mail, thisURL } = require('./config/mailer')
const { temporalDateToNum, toTemporalDateTime } = require('./helperfunctions')

connectDB()

const PORT = process.env.EXPRESS_PORT

app.use(cors())
app.use(express.json())

app.listen(PORT, () => {
    console.log(`listening on port ${PORT}`)
})
 

process.stdin.on('data', data => {
    console.log(`this program does not take in shell arguments.`)
})






const deleteOldAppointments = async() => {

    const now = Temporal.Now.plainDateISO()

    const nowDateAsNum = now.year * 10000 + now.month * 100 + now.day
    const mongoRes = await Appointment.deleteMany({
            "date.dateAsNum": {
                $lt: nowDateAsNum,
            },
    })


    console.log(`\nDeleting past appointments...\nAcknowledged: ${mongoRes.acknowledged}\nDeletedCount: ${mongoRes.deletedCount}\n`)
    


}
deleteOldAppointments()



const deleteUnconfirmedUsersAndTokens = async () => {
    try {

        const now = Temporal.Now.plainDateTimeISO()

        const unconfirmedUsers = await User.find({ confirmed: false })

        console.log(`number of unconfirmed users: ${unconfirmedUsers.length}`)

        /*I'm making a non-filtered find to get the Tokens collection because:
        
        I don't expect the number of tokens to ever be high enough to warrant working out another custom createdAt property*/

        const tokens = await Token.find()

        const expiredTokens = tokens.filter(item => temporalDateToNum(now) - item.numDateCreatedAt > 7)
        
        console.log(`number of expired tokens: ${expiredTokens.length}`)



        if(unconfirmedUsers.length === 0) { 
            console.log('no expired users found')
            return 
        }


        const date = toTemporalDateTime(createdAt)

        let expiredUserIDs = []

        unconfirmedUsers.map((user, index) => {
            //I should just have added custom temporal timestamps tbh
            const timeSinceCreation = now.until(toTemporalDateTime(user.createdAt))
            if(timeSinceCreation.days < 8) return

            expiredUserIDs.push(user._id)
        })

        const deletedUsers = await User.deleteMany({_id: { $in: expiredUserIDs }})

        console.log(`Deletion mongoRes:`)
        console.log(deletedUsers)

    } catch (error) {
        
    }


}
deleteUnconfirmedUsersAndTokens()

try {
    setInterval(() => {
        deleteOldAppointments()
        deleteUnconfirmedUsersAndTokens()
    }, 1000 * 60 * 60)// === one hour

} catch (error) {
    console.log(error)
}


app.post('/problem', async(req, res) => {
    const b = req.body
    const p = await Problem.create(b)
})



app.get('/appointment', async (req, res) => {
    try {
        const appointments = await Appointment.find()
        res.status(200).json(appointments)

    } catch (error) {
        console.log(error)
    }
})

app.get('/appointment/user/:id', async (req, res) => {
    try {
        const appointments = await Appointment.find({"reservation.userID": req.params.id})
        console.log(appointments)

        res.status(200).json(appointments)

    } catch (error) {
        res.status(400)
        console.log(error)
    }
})


app.put('/appointment/user', async (req, res) => {
    try {
        const b = req.body

        const selectedAppointment = await Appointment.findById( b.appointment._id )

        console.log(selectedAppointment._id)

        const selectedSessionType = await SessionType.findById( b.sessionType._id )
        

        console.log(selectedSessionType)

        const user = await User.findById(b.user.id)

        if(!selectedAppointment) return res.status(404).json({ message: 'please select a valid appointment'})

        if(!selectedSessionType) return res.status(404).json({ message: 'please select a valid appointment type'})

        if(!user) return res.status(404).json({ message: 'please log in to book an appointment'})


        


        const updatedAppointment = await Appointment.updateOne({id: selectedAppointment._id}, {
            "reservation.numOfGuests": b.sessionType.participants.max,
            "reservation.price": b.sessionType.price,
            "reservation.userID": b.user.id,
            "reservation.sessionTypeID": b.sessionType._id,
            "reservation.sessionTypeName": b.sessionType.name,
            "reservation.userNotes": b.notes,
        })
        console.log(updatedAppointment)


    } catch (error) {
        console.log(error)
        res.status(400).json({error: error})
    }
})



app.post('/appointment/admin', async (req, res) => {
    try {


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
        let daNumm
        for(let i = 0 ; i < startDate.until(endDate).days; i +=1 ){
            
            dateToAdd = startDate.add({days: i})
            console.log(startDate)
            //onDaysOfWeek === [true, false, true, true, true, false, false] for eack weekday
            if(req.body.onDaysOfWeek[dateToAdd.dayOfWeek - 1] === true)


            daNumm = temporalDateToNum(dateToAdd)
            console.log(daNumm)

            appointmentsArr.push({
                    date: {
                        year: dateToAdd.year,
                        month: dateToAdd.month,
                        day: dateToAdd.day,
                        dayOfWeek: dateToAdd.dayOfWeek,
                        dateAsString: dateToAdd.toString(),
                        dateAsNum: daNumm,
                    }, period:{
                        start: req.body.period.startTime,
                        end: req.body.period.endTime,
                    },
                    //reservation: {} is set in different put
                
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
            "date.dateAsNum": { 
                $gte: req.body.startDate.dateAsNum,
                $lte: req.body.endDate.dateAsNum,
            },
            "date.dayOfWeek": {
                $in: acceptableDaysOfWeek(req.body.onDaysOfWeek)
            }, 
            "period.start": {$gte: req.body.period.startTime},
            "period.end": { $lte: req.body.period.endTime},
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
            return
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
                     
            "date.dayOfWeek": {
                $in: aD
            },
            "date.dateAsNum": {
                $gte: req.body.startDate.asNum,
                $lte: req.body.endDate.asNum,
            },
            "period.start": {
                $gte: req.body.period.startTime
            },
            "period.end": {
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

    } catch (error) {
        res.status(400).json({error: error})
        console.log(error)

    }
})

const emailIsAvailable = async(email) => {
    try {
        const check = await User.findOne({email: email})
        console.log(check)
        if(check === null) return true

        else return false

    } catch (error) {
        console.log(error)
    }
}

app.post('/register', async(req, res) => {
    try {
        console.log('register registered')
        const b = req.body

        const eIA =  await emailIsAvailable(b.email)
        
        if(!eIA){
            console.log('not creating user')
            res.status(200).json({emailIsTaken: true})
            return
        }

        //send confirmation email to email adress via server, if account is not confirmed after 1 day delete account and email
        //TODO do regex validation here too

        const salt = await bcrypt.genSalt()
        const hashedPassword = await bcrypt.hash(req.body.password, salt)



        const newUser = await User.create({
            email: req.body.email,
            password: hashedPassword,
            firstName: req.body.firstName,
            lastName: req.body.lastName,

        })

        const newToken = await Token.create({userID: newUser._id, for: 'confirmUser'})
        console.log('new token is')
        console.log(newToken)



        await mail(b.email, 'User Registration', `
             <a href=${thisURL}/token/${newToken._id} >Click here to finish your registration</a>
        `)

        res.status(200).json({emailIsTaken: false, newUser: newUser})


    } catch (error) {
        res.status(400).json({error: error})
        console.log(error)

    }
})


app.post('/login', async(req, res) => {
    try {

        //TODO encrypt
        const user = await User.findOne({email: req.body.email})

        if( user === null || false === await bcrypt.compare(req.body.password, user.password) ){
            res.status(400).json({authenticated: false})
            return
        }

        
        res.status(200).json({authenticated: true, userData: {firstName: user.firstName, lastName: user.lastName, id: user._id, email: user.email}})

    } catch (error) {
        res.status(400).json({error: error})
        console.log(error)

    }
})

app.post('/forgot/', async(req, res) => {
    try {
        const b = req.body

        console.log(req.ip)

        console.log(b)

        const user = await User.findOne({email: b.email})

        console.log(user)

        if (user === null) return res.status(400).json({userFound: false})

        const oldTokens = await Token.deleteMany({userID: user._id, for: 'forgotPassword'})

        if (oldTokens.deletedCount > 1) await Problem.create({ description: 'multiple forgot password tokens for one user', details: { mongoRes: oldTokens, user: user._id } })

        const newToken = await Token.create({ userID: user._id, for: 'forgotPassword' })

        await mail(b.email, 'Reset Password', `
             <a href=${thisURL}/forgot/${newToken._id} >Click here to reset your password</a>
             <div>Didn't make this request?</div>
             <a href=${thisURL}/report/${b.ip}>Click here</a>
        `)

        res.status(200).json({userFound: true})

    } catch (error) {
        console.log(error) 
    }
})

app.get('/forgot/:tokenid', async(req, res) => {
    try {
        const token = await Token.findById(req.params.tokenid)

        console.log(token)

        res.status(200).redirect(`http://localhost:3000/newpassword/${token._id}`)

    } catch (error) {
        console.log(error)
    }
})

app.post('/forgot/:tokenid', async(req, res) => {
    try {
        const token = await Token.findByIdAndDelete(req.params.tokenid)

        if(token === null) return res.status(400).json({msg: 'Your email link has expired. Start another request to reset your password from the login page?'})

        const salt = await bcrypt.genSalt()
        const hashedPassword = await bcrypt.hash(req.body.password, salt)

        const updated = await User.findByIdAndUpdate(token.userID, { password: hashedPassword })
        console.log(updated)

        //Problem.create({description: 'multiple forgot password tokens existed for user', details: {mongoRes: updated, token: token}})

        res.status(302).json(updated)


    } catch (error) {
        console.log(error)
    }
})


//has to ge a GET because it's pasted into the URL by email <a> tag
app.get('/token/:tokenid', async(req, res) => {
    try {

        const token = await Token.findByIdAndDelete(req.params.tokenid)

        if( token !== null ) {
            const mR = await User.updateOne({_id: token.userID}, {
                confirmed: true
            })
            console.log(mR)
        }
        if( token.for !== "confirmUser" ) Problem.create({ description: 'token.for has been misclassified, should be confirmUser', details: token })
        
        res.status(302).redirect('http://localhost:3000/user/')
    } catch (error) {
        console.log(error) 
    }
})
app.delete('/users/all', async(req, res) => {
    try {
        const mongoRes = await User.deleteMany()
        console.log(mongoRes)
        res.status(200).json(mongoRes)
    } catch (error) {
        console.log(error)
    }
})

app.get('/report/:ip', async(req, res) => {
    try {
        console.log(req.params.ip)
    } catch (error) {
        console.log(error)
    }
})