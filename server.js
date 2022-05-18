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

//uses dd-mm-yyyy format
app.get('/appointment/:date', async (req, res) => {
    try {
        console.log(req)
        //queries mongo object dd-mm-yyyy{hh:mm-hh:mm: false}
        res.json({message: req.params.date})

    } catch (error) {
        
    }
})