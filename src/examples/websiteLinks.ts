import { createWebsiteTriggerHelpers } from '../services/websiteTrigger.js';

const helpers = createWebsiteTriggerHelpers('your_bot_username');

console.log('Customer deep-link:', helpers.customerLink(12345, 'TCK-0001'));
console.log('CS deep-link:', helpers.csLink());
console.log('Admin deep-link:', helpers.adminLink());
