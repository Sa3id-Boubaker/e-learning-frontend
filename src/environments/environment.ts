// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

import packageInfo from '../../package.json';

export const environment = {
  appVersion: packageInfo.version,
  production: false,
  // Used where an absolute URL is required (e.g. EventSource, which can't rely on the dev-server
  // proxy the way relative /api/... HttpClient calls do). Everything else keeps using relative
  // paths via proxy.conf.json.
  apiUrl: 'http://localhost:8080',
  googleClientId: '508532760559-kfd67q4chditaf0qp21uipo8va9fp8q8.apps.googleusercontent.com'
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.

// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
