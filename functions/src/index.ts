import * as functions from 'firebase-functions';
import * as express from 'express';
import ambulanceRouter from './routes/ambulance';

// import * as cors from "cors";

const app = express();

app.use('/', ambulanceRouter);

export const ambulances = functions.https.onRequest(app);
