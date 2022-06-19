import {createLogger, format, transports } from "winston"

const basePath = "./log"

const logger = createLogger({
    level:'info',
    format: format.combine(format.timestamp(), format.json()),
    transports: [
        new transports.File({ filename: basePath + '/error.log', level: 'error' }),
        new transports.File({ filename: basePath + '/info.log' })

    ],
    exceptionHandlers: [
        new transports.File({filename: basePath + '/exceptions.log'})
    ]
})


if (process.env.NODE_ENV !== 'production') {
    logger.add(new transports.Console({
        format: format.simple(),
    }))
}



export default logger