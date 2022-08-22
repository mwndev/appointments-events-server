const mongoose = require('mongoose')

const appointmentSchema = mongoose.Schema({
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
            userID: {
                type: String,
                default: '',
            },

            // if (numOfGuests <= sessionType.participants.max) { do thing }
            numOfGuests: {
                type: Number,
                default: 0,
            },
            sessionTypeID: {
                type: String,
                default: '',
            },
            sessionTypeName: {
                type: String,
                default: '',
            },
            userNotes: {
                type: String,
                default: ''
            },
        },
        
}, {
    timestamps: true,
})

module.exports = mongoose.model('Appointment', appointmentSchema)