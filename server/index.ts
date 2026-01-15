import express, { Express, Request, Response } from "express";
import dotenv from "dotenv";
import crypto from 'crypto'
import request, { Response as _res } from 'request'
import querystring from 'querystring'
import cookieParser from "cookie-parser";
import cors from "cors";
import axios from "axios";
import { Jimp } from "jimp";

dotenv.config();

const stateKey = 'spotify_auth_state';
const scope = 'user-read-playback-state app-remote-control'

const app: Express = express();
const port = process.env.PORT || 3000;

let bearer_token: string;

const IMG_HEIGHT: number = 96;
const IMG_WIDTH: number = 96;

app.use(express.static(__dirname + '/public'))
    .use(cors())
    .use(cookieParser());

const generateRandomString = (length: number) => {
    return crypto.randomBytes(60).toString('hex').slice(0, length);
}

app.get("/", (req: Request, res: Response) => {
    res.send("Spotify OAuth");
});

app.get("/login", (req: Request, res: Response) => {
    const state = generateRandomString(16)
    res.cookie(stateKey, state);
    res.redirect('https://accounts.spotify.com/authorize?' +
        querystring.stringify({
            response_type: 'code',
            client_id: process.env.SPOTIFY_CLIENT_ID,
            scope: scope,
            redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
            state: state
        }));
});

app.get('/callback', function (req: Request, res: Response) {
    var code = req.query.code || null;
    var state = req.query.state || null;
    var storedState = req.cookies ? req.cookies[stateKey] : null;

    if (state === null || state !== storedState) {
        res.redirect('/#' +
            querystring.stringify({
                error: 'state_mismatch'
            }));
    } else {
        res.clearCookie(stateKey);
        const auth: Buffer = Buffer.from(process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET)
        const authOptions = {
            url: 'https://accounts.spotify.com/api/token',
            form: {
                code: code,
                redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
                grant_type: 'authorization_code'
            },
            headers: {
                'content-type': 'application/x-www-form-urlencoded',
                Authorization: 'Basic ' + (auth.toString('base64'))
            },
            json: true
        };


        request.post(authOptions, function (error: Error, response: _res, body: any) {
            if (!error && response.statusCode === 200) {

                var access_token = body.access_token,
                    refresh_token = body.refresh_token;

                bearer_token = body.access_token;
                refresh_token = body.refresh_token;

                var options = {
                    url: 'https://api.spotify.com/v1/me',
                    headers: { 'Authorization': 'Bearer ' + access_token },
                    json: true
                };

                // use the access token to access the Spotify Web API
                request.get(options, function (error: Error, response: _res, body: any) {
                    console.log(body);
                });

                // we can also pass the token to the browser to make requests from there
                res.redirect('/#' +
                    querystring.stringify({
                        access_token: access_token,
                        refresh_token: refresh_token
                    }));
            } else {
                res.redirect('/#' +
                    querystring.stringify({
                        error: 'invalid_token'
                    }));
            }
        });
    }
});

app.get('/refresh_token', function (req: Request, res: Response) {
    const refresh_token = req.query.refresh_token;
    const auth: Buffer = Buffer.from(process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET)

    const authOptions = {
        url: 'https://accounts.spotify.com/api/token',
        headers: {
            'content-type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + (auth.toString('base64'))
        },
        form: {
            grant_type: 'refresh_token',
            refresh_token: refresh_token
        },
        json: true
    };

    request.post(authOptions, function (error, response, body) {
        if (!error && response.statusCode === 200) {
            const access_token = body.access_token,
                refresh_token = body.refresh_token;
            res.send({
                'access_token': access_token,
                'refresh_token': refresh_token
            });
        } else {
            console.log(error)
        }
    });
});

app.get('/current_song', function (req: Request, res: Response) {
    console.log("req")
    if (!bearer_token) {
        res.redirect("/")
    }

    const options = {
        method: 'GET',
        url: 'https://api.spotify.com/v1/me/player/currently-playing',
        headers: {
            Authorization: `Bearer ${bearer_token}`
        }
    };

    axios.request(options).then(async function (response) {
        const albumCoverUrl = response.data.item.album.images[2].url; //Smallest image avail from Spotify

        res.send({
            artist: response.data.item.artists[0].name,
            album: response.data.item.album.name,
            song: response.data.item.name,
            album_cover: albumCoverUrl
        })
    })
})

app.get('/cover', async function (req: Request, res: Response) {
    const coverURL = req.query.url;
    if (typeof coverURL === "string") {
        try {
            //Get album cover
            const imageResponse = await axios.get(coverURL, { responseType: 'arraybuffer' });
            const imageBuffer = Buffer.from(imageResponse.data, 'binary');

            //Resize image
            const image = await Jimp.read(imageBuffer);
            image.resize({w: IMG_HEIGHT, h: IMG_WIDTH});

            //Buffer for BMP img
            const bmpBuffer = Buffer.alloc(IMG_WIDTH * IMG_HEIGHT * 2); //2 bytes per pixel

            //Convert every pixel to RGB565
            for (let y = 0; y < IMG_HEIGHT; y++) {
                for (let x = 0; x < IMG_WIDTH; x++) {
                    const color = image.getPixelColor(x, y);
                    const r = (color >> 24) & 0xff; //Extract red channel
                    const g = (color >> 16) & 0xff; //Extract green channel
                    const b = (color >> 8) & 0xff;  //Extract blue channel

                    //Convert to 16-bit RGB565 format
                    const r5 = (r >> 3) & 0x1f;
                    const g6 = (g >> 2) & 0x3f;
                    const b5 = (b >> 3) & 0x1f;

                    const rgb565 = (r5 << 11) | (g6 << 5) | b5;

                    //Write to the buffer (2 bytes per pixel)
                    bmpBuffer.writeUInt16LE(rgb565, 2 * (y * IMG_HEIGHT + x));
                }
            }

            // Write BMP header
            const bmpHeader = Buffer.alloc(54);
            bmpHeader.write('BM'); //BMP signature
            bmpHeader.writeUInt32LE(54 + bmpBuffer.length, 2); //File size
            bmpHeader.writeUInt32LE(54, 10); //Pixel data offset
            bmpHeader.writeUInt32LE(40, 14); //DIB header size
            bmpHeader.writeUInt32LE(IMG_WIDTH, 18); //Width
            bmpHeader.writeUInt32LE(IMG_HEIGHT, 22); //Height
            bmpHeader.writeUInt16LE(1, 26); //Number of color planes
            bmpHeader.writeUInt16LE(16, 28); //Bits per pixel (RGB565 = 16 bits)
            bmpHeader.writeUInt32LE(0, 30); //Compression
            bmpHeader.writeUInt32LE(bmpBuffer.length, 34); //Image size (raw pixel data)

            //Send the BMP image
            res.setHeader('Content-Type', 'image/bmp');
            res.send(Buffer.concat([bmpHeader, bmpBuffer]));

        } catch (error) {
            console.error('Error processing image:', error);
            res.status(500).send("Error processing image.");
        }
    }
});

app.listen(port, () => {
    console.log(`[server]: Server is running at http://localhost:${port}`);
});

