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


app.listen(PORT, () => {
    console.log(`listening on port ${PORT}`)
})


//for booking an appointment
const Appointment = require('./config/models/appointmentModel')
//uses dd-mm-yyyy format

app.get('/appointment', async (req, res) => {
    try {
        console.log(req.query)
        const month = Number(req.query.month)
        console.log(month)
        const appointments = await Appointment.find({ month: month })
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
        for(let i = 0 ; i < startDate.until(endDate).days; i +=1 ){
            
            dateToAdd = startDate.add({days: i})
            //onDaysOfWeek === [true, false, true, true, true, false, false] for eack weekday
            if(req.body.onDaysOfWeek[dateToAdd.dayOfWeek - 1] === true)

            appointmentsArr.push({
                appointment: {
                    date: {
                        year: dateToAdd.year,
                        month: dateToAdd.month,
                        day: dateToAdd.day,
                        dayOfWeek: dateToAdd.dayOfWeek,
                        dateAsString: dateToAdd.toString(),
                        dateAsNum: (dateToAdd.year * 10000) + (dateToAdd.month * 100) + dateToAdd.day,
                    },
                    period:{
                        start: req.body.period.startTime,
                        end: req.body.period.endTime,
                    },
                    //reservation: {} is set in different put
                }
                
            })
        }
        console.log(appointmentsArr[0])
        const mongoRes = await Appointment.insertMany(appointmentsArr)
        console.log(mongoRes)
        res.status(200).json(mongoRes)
    } catch (err) {
        console.log(err)
        
    }
    
})

app.delete('/appointment/admin', async(req, res) => {
    //req.body.appointment is an object like in the post request
    console.log(req.body)
    try {
        const mongoRes = await Appointment.deleteMany({dateAsNum: { $gte: req.body.startDate.dateAsNum, $lte: req.body.endDate.dateAsNum}})
        res.status(200).json({mongoRes})
    } catch (error) {
        console.log(error.message)
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