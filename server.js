require('dotenv').config()
const express = require('express')
const app = express()
const cors = require('cors')
const pool = require('./pgdb')
const Redis = require('redis')
const passport = require('passport')
const mongoose = require('mongoose')
const connectDB = require('./config/mongodb')

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
app.get('/appointment/:year?/:month?/:day?/:timeframe?', async (req, res) => {
    try {
        const appointments = await Appointment.find()
        res.status(200).json(appointments)

    } catch (error) {
        console.log(error)
    }
})

app.post('/appointment/', async (req, res) => {
    try {
        console.log(req.body)
        const appointment = await Appointment.create({
            appointment: {  
                date: req.body.date,
                email: req.body.email,
                period: req.body.period
            }
    })

    res.status(200).json(appointment)
    } catch (err) {
        console.log(err)
        
    }
    
})

app.delete('/appointment', async(req, res) => {
    //req.body.appointment is an object like in the post request
    console.log(req.body)
    try {
        const appointment = await Appointment.deleteOne({appointment: req.body.appointment})
        res.status(200).json({appointment})
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