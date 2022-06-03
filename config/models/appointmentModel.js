const mongoose = require('mongoose')

const appointmentSchema = mongoose.Schema({
    appointment: {
        date: {
            type: String,
            required: [true, 'enter the date'],
            
        },
        period:{
            type: String,
            //required: [true, 'no time given'],
        },
        email: {
            type: String,
            //required: [true, 'enter email']
        }
            
        
    }
}, {
    timestamps: true,
})

module.exports = mongoose.model('Appointment', appointmentSchema)