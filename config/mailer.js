const nodemailer = require('nodemailer')

const thisURL = 'https://appointments-server.onrender.com/admin'

const clientURL = 'https://appointments-client.onrender.com/admin'

const mail = async (destination, subject, html) => {
    const transporter = nodemailer.createTransport({
        service: 'Hotmail',
        auth: {
            user: 'nodemaimer@outlook.com',
            pass: 'Aa1234567!',
        },
    })


    const options = {
        from: 'nodemaimer@outlook.com',
        to: destination,
        subject: subject,
        html: html,
    }

    transporter.sendMail(options, (info, error) => {
        if(error) return console.log(error) 
        console.log(`Sent ${info.response}`)
    })


}


module.exports = {mail, thisURL, clientURL}