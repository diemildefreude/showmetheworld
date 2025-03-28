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
2) start the local server. In Xampp, this is done by pressing the start buttons for Apache.
3) clone the repository to a folder within your localhost directory. (In the case of Xampp, probably c:/xampp/htdocs)
4) go to the new directory in your terminal: `cd faces`.
5) Initiate npm and install the three.js package: `npm i three`
6) in smtw-backend, rename .env_example to .env and set the value of your API key there.
7) for development, set the absolute fetch path for getSearchResults.php in the findImages() method. Then run: `npm run dev` and open the link shown in the terminal output. 
8) for production, you can leave the relative path getSearchResults.php, run `npm run build` and open `localhost/showmetheworld/dist`
