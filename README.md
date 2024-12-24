# NMEA2000 SeaSmart UI

PWA App to be used with https://github.com/ieb/N2KNMEA0183Wifi firmware. This is a installable PWA that connects to endpoints on the firmwar to provide navigation instruments and management of that firmware. It uses preact and htm for simplicity and size reduction as it was at one time burned into flash with a limit of 1MB. It has been through various iterations mostly targeting use on a ChromeBook and trying to avoid being deprecated. These include a ChromeOS app, Electron app running in a Linux container. PWA using websockets which was unreeliable due to the Websocket ESP32 implementation. It can only be installed from localhost in ChromeOS using  https://github.com/kzahel/web-server-chrome which is a ChromeOS app that runs a webserver. Once that is gone, this app may no be installable on ChromeOS since it connects to the APIs over http (ESP32 http servers do not have https support), and PWAs cannot connect to http unless loaded from localhost on http.


To install on a chromebook or work locally the best solution found so far is to use https://github.com/kzahel/web-server-chrome which is a ChromeOS app that runs a webserver. It only works on Chromebooks now that Google chose to remove the ability to serve a socket. Its unlikely to be possible to run an android app or linux container on a ChromeOS on localhost, since neither are on localhost. For how long this works, who knows.

This repo was split out of https://github.com/ieb/N2KNMEA0183Wifi  location ui/v2 on 24 Dec 2024. The commit history has been maintained, however many of the changes are tracked in the readme for that gitrepo before that date, and the historical git commit messages may releate to changes there. 

<div>
<img width="400" alt="Instruments" src="screenshots/Screenshot 2024-12-24 at 11.44.46.png" />
<img width="400" alt="Internal Store" src="screenshots/Screenshot 2024-12-24 at 11.43.48.png" />
<img width="400" alt="Raw Frame Stream" src="screenshots/Screenshot 2024-12-24 at 11.43.59.png" />
<img width="400" alt="Decoded Messages" src="screenshots/Screenshot 2024-12-24 at 11.44.10.png" />
<img width="400" alt="Admin UI for Flash storage" src="screenshots/Screenshot 2024-12-24 at 11.44.22.png" />
</div>


# Changes

Newest at the top.

* Reworked the menu system and editing layouts to use localstorage rather than the ESP32 flash.
* Added a debug view to debug raw can messages and their storage.


To develop 

    npm install
    npm start
    open http://localhost:8080
    <edit save refresh, no auto refresh, sorry>

To build

    npm build

However a build isnt really worthit for the PWA.

To install 

THis has to be done on localhost whilst the ESP32 cant handle https connections.

