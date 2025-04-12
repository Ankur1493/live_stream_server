import express from 'express';
import cors from 'cors';
import hpp from 'hpp';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { NODE_ENV, PORT, ORIGIN, CREDENTIALS } from '@/config';
import errorMiddleware from '@/middlewares/error';
import { Routes } from '@/types/routes';
import IndexRoute from '@/routes';

class App {
    public app: express.Application;
    public env: string;
    public port: string | number;
    public routes: Routes[];

    constructor() {
        this.app = express();
        this.env = NODE_ENV || 'development';
        this.port = PORT || 3000;

        this.routes = [new IndexRoute()];

        this.initializeMiddlewares();
        this.initializeRoutes();
        this.initializeErrorHandling();
    }

    public listen() {
        this.app.listen(this.port, () => {
            console.log(`=================================`);
            console.log(`======= ENV: ${this.env} =======`);
            console.log(`🚀 App listening on the port ${this.port}`);
            console.log(`http://localhost:${this.port}/api`);
            console.log(`=================================`);
        });
    }

    private initializeRoutes() {
        this.routes.forEach((route) => {
            this.app.use('/api', route.router);
        });
    }

    private initializeMiddlewares() {
        this.app.use(cors({ origin: ORIGIN, credentials: CREDENTIALS }));
        this.app.use(hpp());
        this.app.use(helmet());
        this.app.use(compression());
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
        this.app.use(cookieParser());
    }

    private initializeErrorHandling() {
        this.app.use(errorMiddleware);
    }
}

export default App;
