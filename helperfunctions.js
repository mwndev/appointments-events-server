const temporalDateToNum = (date) => {
    return ( Number(date.year * 10000) + Number(date.month * 100) + Number(date.day) )
}

const toTemporalDateTime = (legacyDate) => {

    return Temporal.PlainDateTime.from(legacyDate.toJSON().substring(0, 23) + '+00:00')

}




module.exports = { temporalDateToNum, toTemporalDateTime,  }