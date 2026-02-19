const http = require('http');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const app = express();

module.exports = class UserServer {
    constructor({ config, managers }) {
        this.config = config;
        this.userApi = managers.userApi;
        this.managers = managers;
    }
    
    /** for injecting middlewares */
    use(args) {
        app.use(args);
    }

    /** server configs */
    run() {
        app.use(cors({ origin: '*' }));
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));
        app.use('/static', express.static('public'));

        const globalLimiter = rateLimit({
            windowMs: 15 * 60 * 1000,
            max: 100,
        });

        const loginLimiter = rateLimit({
            windowMs: 15 * 60 * 1000,
            max: 10,
        });

        app.use('/api/', globalLimiter);
        app.use('/api/user/login', loginLimiter);

        app.get('/health', (req, res) => {
            this.managers.responseDispatcher.dispatch(res, {
                ok: true,
                data: {
                    service: this.config.dotEnv.SERVICE_NAME,
                    version: this.config.packageJson && this.config.packageJson.version ? this.config.packageJson.version : 'unknown',
                    timestamp: new Date().toISOString(),
                },
            });
        });

        /** an error handler */
        app.use((err, req, res, next) => {
            console.error(err.stack);
            res.status(500).send('Something broke!');
        });
        
        /** a single middleware to handle all */
        app.all('/api/:moduleName/:fnName', this.userApi.mw);

        const port = this.config.dotEnv.USER_PORT;
        let server = http.createServer(app);
        server.listen(port, '0.0.0.0', () => {
            console.log(`${(this.config.dotEnv.SERVICE_NAME).toUpperCase()} is running on port: ${port}`);
        });
    }
};