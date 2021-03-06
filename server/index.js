import 'babel-polyfill';
import bodyParser from 'body-parser';
import mongoose from 'mongoose';
import express from 'express';
import dotenv from 'dotenv';
import passport from 'passport';
import { Strategy } from 'passport-http-bearer';
import bcrypt from 'bcryptjs';
import uuidV1 from 'uuid/v1';
import shortid from 'shortid';
import _ from 'underscore';
import User from './models/users';
import FlightFetcher from './handlers/flightFetcher';
import * as userValidity from './handlers/userValidity';
import verifyPassword from './handlers/verifyPassword';

dotenv.config({ silent: true });
const salt = bcrypt.genSaltSync(10);

mongoose.Promise = global.Promise;

const HOST = process.env.HOST;
const PORT = process.env.PORT || 3000;

console.log(`Server running in ${process.env.NODE_ENV} mode`);

const app = express();
const jsonParser = bodyParser.json();

app.use(express.static(process.env.CLIENT_PATH));

passport.use(new Strategy(
  (accessToken, callback) => {
    User.findOne({ accessToken }, (err, user) => {
      if (err) {
        console.log(err);
        return callback(err);
      }
      if (!user) return callback(null, false);

      return callback(null, user);
    });
  }
));

app.get('/flights/:flightNumber/:flightDate/:departureAirport', passport.authenticate('bearer', { session: false }),
  (req, res) => {
  const { flightNumber, flightDate, departureAirport } = req.params;
  const flightDetails = new FlightFetcher(flightNumber, flightDate, departureAirport);
  flightDetails.getFlightInfo((err, flightInfo) => {
    if (err) {
      console.log(err);
      return res.status(404).json({ displayMessage: 'Information for that flight not found.' });
    }
    console.log('flightInfo', flightInfo);
    return res.status(200).json(flightInfo);
  });
});

//on refresh see if user was logged in, if so, log them back in
app.get('/find/cookie/:accessToken', (req, res) => {
  const { accessToken } = req.params;
  User.find({ accessToken }, (err, existingUser) => {
    if (err) {
      console.error(err);
      return res.send(err);
    }
    if (existingUser.length) {
      const { name, id, email, accessToken } = existingUser[0];
      return res.status(200).json({ name, id, email, accessToken });
    }
      return res.status(404).json({ displayMessage: 'User not found' });
  });
});


app.post('/fblogin', jsonParser, (req, res) => {
	const { email, name, id } = req.body.profile;
	const { accessToken } = req.body.tokenDetail;

	//see if the user already exists in the database
	User.find({ email }, (err, existingUser) => {
		if (err) {
			console.error(err);
			return res.send(err);
		}

		//if they do, send back their info
		if (existingUser.length) {
			return res.status(200).json(existingUser[0]);
		}

		//if they don't, create an account then send back their info
		User.create({ name, email, _id: id, accessToken }, (err, newUser) => {
			if (err) {
				console.error(err);
				return res.send(err);
			}
			return res.status(200).json(newUser);
		});
	});
});

app.post('/login', jsonParser, (req, res) => {
  const { email, password } = req.body;

  if (!userValidity.allFormFieldsFilledIn(req.body)) {
    return res.status(422).json({ displayMessage: 'All fields are required.' });
  }
    User.find({ email }, (err, existingUser) => {
			if (err) {
				console.error(err);
				return res.send(err);
			}

			//make sure email exists in db
			if (!existingUser.length) {
				return res.status(401).json(
          { displayMessage: 'The email address you entered is not registered with us.' }
        );
			}

			//verify that password is correct, if so send back user info
			if (verifyPassword(password, existingUser[0].salt, existingUser[0].password)) {
				const { name, id, email, accessToken } = existingUser[0];
				return res.status(200).json({ name, id, email, accessToken });
			}

			return res.status(401).json({ displayMessage: 'The password you entered is incorrect.' });
    });
  });


app.post('/signup', jsonParser, (req, res) => {
	const user = req.body;
	const { name, email, password } = req.body;
	const passwordToSave = bcrypt.hashSync(password, salt);
  const userValidityCheck = userValidity.signUpValidity(user);

  //make sure user info that was submitted is valid
  if (userValidityCheck.isInvalid) {
    return res.status(userValidityCheck.status).json({ displayMessage: userValidityCheck.message });
  }

  User.find({ email }, (err, existingUser) => {
		if (err) {
			console.error(err);
			return res.send(err);
		}

		//make sure email is not already in the db
    if (existingUser.length) {
      if (!_.has(existingUser[0], 'password')) {
        return res.status(409)
       .json({ displayMessage:
        'This account was registered with Facebook. Please use the Facebook login option.'
        });
      }

      return res.status(409)
       .json({ displayMessage: 'That email address is already on file. Try logging in.' });
    }

    //if all checks are passed, create an account and send back user info
		User.create(
			{ name,
				email,
				salt,
				_id: shortid.generate(),
				password: passwordToSave,
				accessToken: uuidV1()
			}, (err, newUser) => {
			if (err) {
				console.error(err);
				return res.send(err);
			}
			const { name, id, email, accessToken } = newUser;
			return res.status(200).json({ name, id, email, accessToken });
		});
  });
});

app.post('/logout', passport.authenticate('bearer', { session: false }), (req, res) => {
  res.sendStatus(200);
});


function runServer() {
	const databaseUri = process.env.DATABASE_URI || global.databaseUri;
	mongoose.connect(databaseUri);
	return new Promise((resolve, reject) => {
		app.listen(PORT, HOST, (err) => {
				if (err) {
					console.error(err);
					reject(err);
				}
				const host = HOST || 'localhost';
				console.log(`Listening on ${host}:${PORT}`);
		});
	});
}

if (require.main === module) {
		runServer();
}

