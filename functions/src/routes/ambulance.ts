import * as express from 'express';
import * as admin from 'firebase-admin';
const axios = require('axios').default;
import getDistance from 'geolib/es/getDistance';

// Was used when filling initial data
// import { GeoPoint } from '@google-cloud/firestore';

// eslint-disable-next-line new-cap
const ambulanceRouter = express.Router();

admin.initializeApp();

const COLLECTION_NAME = 'drivers';

// was used to export data from firestore
// ambulanceRouter.route('/export').get(async (req, res) => {
//   const snapshot = await admin
//     .firestore()
//     .collection(COLLECTION_NAME)
//     .orderBy('provinsi')
//     .orderBy('kotaKabupaten')
//     .orderBy('namaInstansi')
//     .get();

//   const ambulances: any[] = [];

//   snapshot.forEach((doc) => {
//     const id = doc.id;
//     const data = doc.data();

//     ambulances.push({
//       id,
//       namaInstansi: data.namaInstansi,
//       kotaKabupaten: data.kotaKabupaten,
//       provinsi: data.provinsi,
//       alamatDaerahOperasiAmbulance: data.alamatDaerahOperasiAmbulance,
//       kontakPicAmbulance: data.kontakPicAmbulance,
//       keterangan: data.keterangan,
//       namaDriver: data.namaDriver,
//       platNomor: data.platNomor,
//       geopoint: data.geopoint,
//       ready: data.ready,
//       statusDatabse: data.statusDatabse,
//     });
//   });

//   res.status(200).json({ count: ambulances.length, data: ambulances });
// });

ambulanceRouter.route('/closest').get(async (req, res) => {
  if (typeof parseInt(`${req.query.radius}`) !== 'number') {
    res.status(400).send({ message: 'radius must be a number.' });
  }

  if (req.query.location === undefined) {
    res.status(400).json({ message: 'location is required.' });
  }

  const radius: number = parseInt(`${req.query.radius}`) || 5000;
  const location: string =
    req.query.location?.toString() || '-6.175391210397589,106.8271543734456';
  const user: { latitude: number; longitude: number } = {
    latitude: parseFloat(location.split(',')[0]),
    longitude: parseFloat(location.split(',')[1]),
  };

  const snapshot = await admin
    .firestore()
    .collection(COLLECTION_NAME)
    .where('ready', '==', true)
    .get();

  let ambulances: {
    id: string;
    namaInstansi: string;
    kontakPicAmbulance: string;
    namaDriver: string;
    platNomor: string;
    geopoint: {
      _latitude: number;
      _longitude: number;
    };
    distance: number;
    distanceOnTheRoad: any;
    duration: any;
  }[] = [];

  snapshot.forEach((doc) => {
    const data = doc.data();
    const distance = getDistance(
      { latitude: user.latitude, longitude: user.longitude },
      {
        latitude: data.geopoint._latitude,
        longitude: data.geopoint._longitude,
      }
    );

    if (distance < radius) {
      ambulances.push({
        id: doc.id,
        namaInstansi: data.namaInstansi,
        kontakPicAmbulance: data.kontakPicAmbulance,
        namaDriver: data.namaDriver,
        platNomor: data.platNomor,
        geopoint: {
          _latitude: data.geopoint._latitude,
          _longitude: data.geopoint._longitude,
        },
        distance: distance,
        distanceOnTheRoad: {},
        duration: {},
      });
    }
  });

  if (ambulances.length === 0) {
    res
      .status(200)
      .send({ found: 0, message: `no ambulance found in this area` });
  }

  ambulances = ambulances
    .sort((a, b) => {
      return a.distance - b.distance;
    })
    .filter((item, idx) => idx < 25);

  const geopointDestination = ambulances
    .map(
      (ambulance) =>
        `${ambulance.geopoint._latitude},${ambulance.geopoint._longitude}|`
    )
    .join('');

  let mapData: {}[] = [];

  let origin_addresses: any;

  const apiKey = 'AIzaSyB2pfhnQDgT81St-d6bLQHxj2acPlpZ6v4';
  await axios
    .get(
      `https://maps.googleapis.com/maps/api/distancematrix/json?destinations=${geopointDestination}&origins=${location}&key=${apiKey}`
    )
    .then((response: any) => response.data)
    .then((data?: any) => {
      origin_addresses = data.origin_addresses;
      return data.rows[0];
    })
    .then((row?: any) => row.elements)
    .then((elements?: any) => {
      mapData = elements;
    })
    .catch(function (error: any) {
      res.status(400).json({
        message: error.message,
        data: ambulances,
        origin_addresses: origin_addresses,
      });
    });

  mapData.forEach((element: any, idx: any) => {
    if (element.status === 'OK') {
      ambulances[idx].distanceOnTheRoad = element.distance;
      ambulances[idx].duration = element.duration;
    }
  });

  ambulances.sort((a, b) => {
    return a.duration.value - b.duration.value;
  });

  res.status(200).json({
    origin_addresses: origin_addresses || 'unknown',
    found: ambulances.length,
    ambulances: ambulances,
  });
});

/* It's getting the ambulance data. */
ambulanceRouter
  .route('/')
  .get(async (req, res) => {
    if (req.query.provinsi) {
      const snapshot = await admin
        .firestore()
        .collection(COLLECTION_NAME)
        .where('provinsi', '==', req.query.provinsi)
        .get();

      const ambulances: any[] = [];

      snapshot.forEach((doc) => {
        const id = doc.id;
        const data = doc.data();

        ambulances.push({
          id,
          namaInstansi: data.namaInstansi,
          kotaKabupaten: data.kotaKabupaten,
          provinsi: data.provinsi,
          alamatDaerahOperasiAmbulance: data.alamatDaerahOperasiAmbulance,
          kontakPicAmbulance: data.kontakPicAmbulance,
          keterangan: data.keterangan,
          namaDriver: data.namaDriver,
          platNomor: data.platNomor,
          geopoint: data.geopoint,
        });
      });

      res.status(200).json({ count: ambulances.length, data: ambulances });
    }

    if (req.query.kotaKabupaten) {
      const snapshot = await admin
        .firestore()
        .collection(COLLECTION_NAME)
        .where('kotaKabupaten', '==', req.query.kotaKabupaten)
        .get();

      const ambulances: any[] = [];

      snapshot.forEach((doc) => {
        const id = doc.id;
        const data = doc.data();

        ambulances.push({
          id,
          namaInstansi: data.namaInstansi,
          kotaKabupaten: data.kotaKabupaten,
          provinsi: data.provinsi,
          alamatDaerahOperasiAmbulance: data.alamatDaerahOperasiAmbulance,
          kontakPicAmbulance: data.kontakPicAmbulance,
          keterangan: data.keterangan,
          namaDriver: data.namaDriver,
          platNomor: data.platNomor,
          geopoint: data.geopoint,
        });
      });

      res.status(200).json({ count: ambulances.length, data: ambulances });
    }

    if (req.query.namaInstansi) {
      const snapshot = await admin
        .firestore()
        .collection(COLLECTION_NAME)
        .where('namaInstansi', '==', req.query.namaInstansi)
        .get();

      const ambulances: any[] = [];

      snapshot.forEach((doc) => {
        const id = doc.id;
        const data = doc.data();

        ambulances.push({
          id,
          namaInstansi: data.namaInstansi,
          kotaKabupaten: data.kotaKabupaten,
          provinsi: data.provinsi,
          alamatDaerahOperasiAmbulance: data.alamatDaerahOperasiAmbulance,
          kontakPicAmbulance: data.kontakPicAmbulance,
          keterangan: data.keterangan,
          namaDriver: data.namaDriver,
          platNomor: data.platNomor,
          geopoint: data.geopoint,
        });
      });

      res.status(200).json({ count: ambulances.length, data: ambulances });
    }

    const snapshot = await admin
      .firestore()
      .collection(COLLECTION_NAME)
      .orderBy('provinsi')
      .orderBy('kotaKabupaten')
      .orderBy('namaInstansi')
      .get();

    const ambulances: any[] = [];

    snapshot.forEach((doc) => {
      const id = doc.id;
      const data = doc.data();

      ambulances.push({
        id,
        namaInstansi: data.namaInstansi,
        kotaKabupaten: data.kotaKabupaten,
        provinsi: data.provinsi,
        alamatDaerahOperasiAmbulance: data.alamatDaerahOperasiAmbulance,
        kontakPicAmbulance: data.kontakPicAmbulance,
        keterangan: data.keterangan,
        namaDriver: data.namaDriver,
        platNomor: data.platNomor,
        geopoint: data.geopoint,
      });
    });

    res.status(200).json({ count: ambulances.length, data: ambulances });
  })
  .post(async (req, res) => {
    const ambulance = {
      namaInstansi: req.body.namaInstansi,
      kotaKabupaten: req.body.kotaKabupaten,
      provinsi: req.body.provinsi,
      alamatDaerahOperasiAmbulance: req.body.alamatDaerahOperasiAmbulance,
      kontakPicAmbulance: req.body.kontakPicAmbulance,
      keterangan: req.body.keterangan,
    };

    res
      .status(200)
      .json({ message: 'post still in maintenace', data: ambulance });
  });

/* It's getting the ambulance data by id. */
ambulanceRouter
  .route('/:id')
  .get(async (req, res) => {
    const document = await admin
      .firestore()
      .collection(COLLECTION_NAME)
      .doc(req.params.id)
      .get();

    if (!document.exists) {
      res.status(404).send('Document not found');
    }

    res.status(200).json(document.data());
  })
  .put(async (req, res) => {
    res.status(200).json({ message: 'put still in maintenace' });
  })
  .delete(async (req, res) => {
    res.status(200).json({ message: 'delete still in maintenace' });
  });

export default ambulanceRouter;
