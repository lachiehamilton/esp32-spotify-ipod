# ESP32 Spotify-iPod Controller
ESP32 code and server for iPod Classic like Spotify controller

This project was undertaken in October 2024 and was last known working then. AI was used in a light capacity to assist and speed up development.

# Server Instructions
Create .env file

Fill out the following in .env

SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
SPOTIFY_REDIRECT_URI=
PORT=

(Spotify details can be created through Spotify Developer Dashboard)

Run with npm run start

# Arduino instructions

Enter your WiFi SSID and password into the script

Enter the IP address and port of your server into the script

Install the spotify.ino on your ESP32 microcontroller

# Known issues

Visual glitches with the album cover.

# Challenges

This project was an interesting challenge for a number of reasons.

I realised quickly that the memory limitations of my ESP32 Arduino board (32kb) would make running communications with the Spotify API difficult. While maybe possible, I just opted to create a seperate server and have that streamline the process and provide a minimal response to the Arduino board.

The more significant challenge proved to be rendering the album cover. Firstly, the DFRobot screen I was using needed it in a Bitmap format in RGB565. I was able to have my server work as an intermediary to parse the Spotify provided image to this format. The next challenge was having a larger image appear on the device than I had memory for. I could have settled for a 16x16 pixel image within my memory limitations, but this was far too small. As ultimately the image had to be stored in memory, as a bitmap, before it was rendered, using lossy image formats or other traditional memory saving techniques would not work here. In the end, I worked out that I could render it in chunks and clear it from memory as I went, to stream it onto the screen. This works fairly well, although you can visually see it happening.

I ended up moving on from this project before fixing some of the visual bugs with the album cover, but by and large this project works well. 