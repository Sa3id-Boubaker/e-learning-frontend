import packageInfo from '../../package.json';

export const environment = {
  appVersion: packageInfo.version,
  production: true,
  // Update to the deployed API Gateway's publicly-reachable address.
  apiUrl: 'http://localhost:8080',
  googleClientId: '508532760559-kfd67q4chditaf0qp21uipo8va9fp8q8.apps.googleusercontent.com'
};
