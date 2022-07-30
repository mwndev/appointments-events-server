const mongoose = require('mongoose')

const appointmentSchema = mongoose.Schema({
    appointment: {
        
        date: {
            year: {
                type: Number,
                required: [true, 'y']
            },
            month: {
                type: Number,
                required: [true, 'm']
            },
            day: {
                type: Number,
                required: [true, 'd']
            },
            dayOfWeek: {
                type: Number,
                required: [true, 'dayofweek']
            },
            dateAsNum: {
                type: Number,
                required: true,
            },
            dateAsString: String,
        },
        period:{
            start: {
                type: Number,
                required: [true, 'start of period']
            },
            end: {
                type: Number,
                required: [true, 'end of period']
            },
        },
        reservation: {
            email: {
                type: String,
                default: null,
            },
            isTaken: {
                type: Boolean,
                default: false,
            }
        },
        typeName: {
            type: String,
            required: [true, 'enter type of appointment'],
        },
        
        
    }
}, {
    timestamps: true,
})

module.exports = mongoose.model('Appointment', appointmentSchema)