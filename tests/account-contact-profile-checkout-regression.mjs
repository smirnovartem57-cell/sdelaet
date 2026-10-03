import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const account=readFileSync(new URL('../src/customer-account.mjs',import.meta.url),'utf8');
const profile=readFileSync(new URL('../profile.html',import.meta.url),'utf8');
const journey=readFileSync(new URL('../assets/task-journey-v1.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../assets/research-pricing-v2.css',import.meta.url),'utf8');

assert.match(account,/ALTER TABLE customer_profiles ADD COLUMN name TEXT/);
assert.match(account,/ALTER TABLE customer_profiles ADD COLUMN phone TEXT/);
assert.match(account,/ALTER TABLE customer_profiles ADD COLUMN notification_channel TEXT/);
assert.match(account,/notificationChannel/);

assert.match(profile,/profileName/);
assert.match(profile,/profilePhone/);
assert.match(profile,/profileNotifications/);

assert.match(journey,/Использовать данные из профиля/);
assert.match(journey,/Указать другие данные/);
assert.match(journey,/Только для этой задачи/);
assert.match(journey,/function applyCheckoutContactMode\(\)/);
assert.match(journey,/request\('\/v1\/account\/profile'\)/);
assert.match(journey,/Сохранить имя, телефон и уведомления в профиле/);

assert.match(css,/\.checkout-profile-choice/);
assert.match(css,/\.checkout-save-profile/);

console.log('Account contact profile checkout regression: PASS');
