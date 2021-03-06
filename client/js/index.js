import 'babel-polyfill';
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { HashRouter as Router, Route } from 'react-router-dom';
import RequiresAuth from './auth/RequireAuth';
import RememberUser from './auth/RememberUser';
import store from './store';
import HomePage from './components/HomePage';
import FlightsPage from './components/FlightsPage';
import LoginPage from './components/LoginPage';
import SignUpPage from './components/SignUpPage';
import Navbar from './components/Navbar';

const allRoutes = (
  <Provider store={store}>
    <Router>
      <div>
        <Route component={Navbar} />
        <Route exact path="/" component={RememberUser(HomePage)} />
        <Route path="/flights" component={RequiresAuth(FlightsPage)} />
        <Route path="/signup" component={SignUpPage} />
        <Route path="/login" component={LoginPage} />
      </div>
    </Router>
  </Provider>
);

document.addEventListener('DOMContentLoaded', () => ReactDOM.render(
      allRoutes,
    document.getElementById('app')
  ));

console.log(`Client running in ${process.env.NODE_ENV} mode`);
