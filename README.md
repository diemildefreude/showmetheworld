# showmetheworld

interactive train ride, live at [sepweb.dev/showmetheworld](https://sepweb.dev/showmetheworld)

compatibility
--------
Currently tested and working on Windows 11 in Edge and Chrome.

Does not work in Firefox due to WebSpeechAPI being disabled.

Android and Apple devices have some graphical bugs.

Currently set to use the Bing Search API for getting images. Could be changed to something else...

prerequisites
--------
-npm

-three.js (via npm)

-a bing search api key from [portal.azure.com](https://portal.azure.com)

setup
--------
1) set up a local server using something like [Xampp](https://www.apachefriends.org/download.html) 
2) start the local server. In Xampp, this is done by pressing the start buttons for Apache. (this and the previous step can be skipped if only running in dev mode)
3) clone the repository to a folder within your localhost directory. (In the case of Xampp, probably c:/xampp/htdocs)
4) in main.js, set searchApiKey (l.88) to your Bing API key.
5) Go to the new directory in your terminal: `cd faces`.
6) Initiate npm and install the three.js package: `npm i three`
7) for development, run: `npm run dev` and open the link shown in the terminal output
8) for production, run `npm run build` and open `localhost/showmetheworld/dist`
