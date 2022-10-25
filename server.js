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
const { mail, thisURL, clientURL } = require('./config/mailer')
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

const adminEmails = [process.env.ADMIN_EMAIL_ONE , process.env.ADMIN_EMAIL_TWO]

const verifyAdmin = async (email, password) => {
    try {
        if( !adminEmails.includes(email)) return false 

        const account = await User.findOne({ email: email })

        return await bcrypt.compare(password, account.password)

    } catch (error) {
        console.log(error)
    }
}



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


app.get('/', async(req, res) => {
    res.status(200).send("This is the backend. Everything except for this route is json data.")
})

app.post('/problem', async(req, res) => {
    const b = req.body
    const p = await Problem.create({details: b})
})



app.get('/appointment', async (req, res) => {
    try {
        const appointments = await Appointment.find()
        res.status(200).json(appointments)

    } catch (error) {
        console.log(error)
    }
})
app.get('/appointment/available', async (req, res) => {
    try {
        const appointments = await Appointment.find({ "reservation.userID": "" })

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

        if(! await bcrypt.compare(b.user.password, user.password) ) return res.status(404).json({ msg: 'Please log out and then log in again. There\'s a problem with our database.'})

        if(!user.confirmed) return res.status(404).json({ msg: 'please click the \"confirm account\" link you were sent when creating your account'})

        if(!selectedAppointment) return res.status(404).json({ msg: 'please select a valid appointment'})

        if(!selectedSessionType) return res.status(404).json({ msg: 'please select a valid appointment type'})

        if(!user) return res.status(404).json({ msg: 'please log in to book an appointment'})


        res.status(200).json({message: 'please check your email to confirm your booking'})

        const oldTokens = await Token.deleteMany({userID: user._id, for: 'confirmReservation'})

        const newToken =  await Token.create({
            other: {
                appointmentID: selectedAppointment._id,
                reservation: {
                    numOfGuests: b.sessionType.participants.max,
                    price: b.sessionType.price,
                    userID: b.user.id,
                    sessionTypeID: b.sessionType._id,
                    sessionTypeName: b.sessionType.name,
                    userNotes: b.notes,
                }
            },
            userID: user._id, 
            for: 'confirmReservation'})

        await mail(b.user.email, 'Confirm Appointment', `
            <h2>Hi ${user.firstName}!</h2>
            <a href=${clientURL}/reserve/${newToken._id} >Click here to confirm your reservation</a>
            <div>Didn't make this request?</div>
            <a href=${thisURL}/report/${req.ip}>Click here</a>
        `)


    } catch (error) {
        console.log(error)
        res.status(400).json({error: error})
    }
})

app.get('/reserve/:tokenid', async(req, res) => {
    try {
        const token = await Token.findById(req.params.tokenid)

        if(token === null) return res.status(400).json({reserved: false, reason: 'expired link'})

        const { reservation } = token.other

        console.log(reservation)

        const appointment = await Appointment.findById(token.other.appointmentID)

        if( ! appointment.reservation.userID === '' ) return res.status(400).json({
            reserved: false, 
            reason: 'someone else booked the appointment before you clicked the link'
        })

        const updatedAppointment = await Appointment.findByIdAndUpdate(token.other.appointmentID, {reservation})
        console.log(updatedAppointment)

        const user = await User.findById(token.userID)

        //TODO edit if statement
        await mail(user.email, 'Your appointment has been confirmed!', `
            <div>The details can always be viewed on your account page on our website.</div>
        `)

        token.delete()

        res.status(200).json({reserved: true})


    } catch (error) {
        console.log(error)
        res.status(400).json({error: error})
    }
})



app.post('/appointment/admin', async (req, res) => {
    try {
        if(!verifyAdmin(req.body.userData.email, req.body.userData.password)) return res.status(400).json({msg: 'admin verification failed'})


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
        let num
        for(let i = 0 ; i < startDate.until(endDate).days; i +=1 ){
            
            dateToAdd = startDate.add({days: i})

            console.log(req.body.onDaysOfWeek)
            //onDaysOfWeek === [true, false, true, true, true, false, false] for eack weekday
            if(req.body.onDaysOfWeek[dateToAdd.dayOfWeek - 1] === true){

                num = temporalDateToNum(dateToAdd)
                console.log(num)

                appointmentsArr.push({
                        date: {
                            year: dateToAdd.year,
                            month: dateToAdd.month,
                            day: dateToAdd.day,
                            dayOfWeek: dateToAdd.dayOfWeek,
                            dateAsString: dateToAdd.toString(),
                            dateAsNum: num,
                        }, period:{
                            start: req.body.period.startTime,
                            end: req.body.period.endTime,
                        },
                        "reservation.numOfGuests": 0,
                        //reservation: {} is set in different put
                    
                })
            }
        }

        const mongoRes = await Appointment.insertMany(appointmentsArr)
        res.status(200).json(mongoRes)


    } catch (err) {
        console.log(err)
        
    }
    
})

app.delete('/appointment/admin', async(req, res) => {
    //req.body.appointment is an object like in the post request
    
    try {
        if(!verifyAdmin(req.body.userData.email, req.body.userData.password)) return res.status(400).json({msg: 'admin verification failed'})


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
            "reservation.numOfGuests": 0,
        })
        console.log(mongoRes)
        
        res.status(200).json({mongoRes})
    } catch (error) {
        console.log(error.message)
    }
})

app.delete('/admin/byid', async (req, res) => {
    try {
        const b = req.body
        if(! await verifyAdmin(b.userData.email, b.userData.password)) return res.status(400).json({msg: 'admin verification failed'})
        console.log(b.objectIDArray)
        
        const mongoRes = await Appointment.deleteMany({_id: { $in: b.objectIDArray }})
        console.log(mongoRes)
        res.status(200).json({msg: `appointments deleted: ${mongoRes.deletedCount}`})
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
app.get('/appointment/admin/:email/:password', async(req, res) => {

    const {email, password} = req.params

    if(!adminEmails.includes(email)) return res.status(400).json({ verified: false })

    const user = await User.findOne({ email: email })

    if( !await bcrypt.compare(password, user.password) ) return res.status(400).json({ verified: false })

    const appointments = await Appointment.find()

    console.log(appointments)

    res.status(200).json({ verified: true, appointments: appointments })


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
        if(! await verifyAdmin(req.body.userData.email, req.body.userData.password)) return res.status(400).json({msg: 'admin verification failed'})
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
        if(! await verifyAdmin(req.body.userData.email, req.body.userData.password)) return res.status(400).json({msg: 'admin verification failed'})
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

        const user = await User.findOne({email: req.body.email})

        if( user === null || false === await bcrypt.compare(req.body.password, user.password) ){
            res.status(400).json({authenticated: false})
            return
        }

        const isAdmin = adminEmails.includes(user.email)
        
        res.status(200).json({ authenticated: true, userData: {
            id: user._id, 
            firstName: user.firstName, 
            lastName: user.lastName, 
            email: user.email, 
            password: req.body.password,
            isAdmin: isAdmin,
        }})

    } catch (error) {
        res.status(400).json({error: error})
        console.log(error)

    }
})

app.put('/cancel', async(req, res) => {
    try {
        const b = req.body
        const user = await User.findOne({email: b.email})
        console.log('cancelling')


        console.log('updatedAppointment:')
        const updatedAppointment = await Appointment.findByIdAndUpdate(b.id, { reservation: {
            userID: '',
            numOfGuests: 0,
            sessionTypeID: '',
            sessionTypeName: '',
            userNotes: '',
        }})
        console.log(updatedAppointment)

        res.status(200).json({cancelled: true})

    } catch (error) {
        console.log(error)
    }
})

app.put('/cancel/admin', async(req, res) => {
    try {
        const b = req.body
        console.log(b)
        if(! await verifyAdmin(req.body.userData.email, req.body.userData.password)) return res.status(400).json({msg: 'admin verification failed'})

        console.log('updatedAppointment:')
        const updatedAppointments = await Appointment.updateMany({
            _id: { $in: b.idArray }
        }, {
            reservation: {
                userID: '',
                numOfGuests: 0,
                sessionTypeID: '',
                sessionTypeName: '',
                userNotes: '',
            }
        })
        console.log(updatedAppointments)

        res.status(200).json({cancelled: true, msg: `${updatedAppointments.modifiedCount} appointments were cancelled`})

    } catch (error) {
        console.log(error)
    }
})

app.put('/user', async(req, res) => {
    try {
        const user = await User.findById(req.body.id)

        if( user === null ) { 
            await Problem.create({description: 'this user is logged in but their user id does not match any user saved on the server', details: req.body.id })
            res.status(400).json({msg: 'Something went wrong. The error has been reported to the owner.'})
            return 
        }
        console.log(req.body)

        const match = await bcrypt.compare( req.body.password, user.password, )

        if( !match ) {
            await Problem.create({
                description: 'this user is logged in but their saved password does not match any user saved on the server', 
                details: {
                    text: 'bcrypt.compare(req.body.pw, user.password) === false',
                    user: user,
                },
            })
            res.status(400).json({msg: 'Something went wrong. The error has been reported to the owner.'})
            return 
        }

        let updatedUser = await User.findByIdAndUpdate(req.body.id, req.body.newData)
        delete updatedUser.password

        res.status(200).json(updatedUser)

    } catch (error) {
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

        await mail(user.email, 'Reset Password', `
             <a href=${thisURL}/forgot/${newToken._id} >Click here to reset your password</a>
             <div>Didn't make this request?</div>
             <a href=${thisURL}/report/${b.ip}/${newToken._id}>Click here</a>
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

app.get('/report/:ip/:tokenid', async(req, res) => {
    try {
        await Token.findByIdAndDelete(req.params.tokenid)
        console.log(req.params.ip)
    } catch (error) {
        console.log(error)
    }
})