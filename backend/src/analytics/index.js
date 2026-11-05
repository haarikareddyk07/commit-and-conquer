const alertService = require('./alertService');
const energyAnalytics = require('./energyAnalytics');
const hygieneAnalytics = require('./hygieneAnalytics');
const wasteAnalytics = require('./wasteAnalytics');
const insights = require('./insights');

module.exports = {
  ...alertService,
  ...energyAnalytics,
  ...hygieneAnalytics,
  ...wasteAnalytics,
  ...insights
};
