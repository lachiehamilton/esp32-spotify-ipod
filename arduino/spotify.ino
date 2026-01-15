#include "DFRobot_GDL.h"
#include "WiFi.h"
#include "Arduino_JSON.h"

/*M0*/
#if defined ARDUINO_SAM_ZERO
#define TFT_DC 7
#define TFT_CS 5
#define TFT_RST 6
/*ESP32 and ESP8266*/
#elif defined(ESP32) || defined(ESP8266)
#define TFT_DC D2
#define TFT_CS D6
#define TFT_RST D3
/*AVR series mainboard*/
#else
#define TFT_DC 2
#define TFT_CS 3
#define TFT_RST 4
#endif

DFRobot_ST7789_240x320_HW_SPI screen(TFT_DC, TFT_CS, TFT_RST);

const char* ssid = "";    //Wifi SSID
const char* password = "";  //Wifi password

WiFiClient client;

void setup() {
  Serial.begin(115200);
  screen.begin();
  screen.fillScreen(COLOR_RGB565_RED);

  //Connect to internet
  Serial.print("Connecting..");
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.print(".");
  }
  Serial.println("Connected to Wifi");
  while (WiFi.status() == WL_CONNECTED) {
    delay(2000);
    getdata();
  }
}

void loop() {
}

const char* currentSong;

void getdata() {
  if (client.connect("192.168.0.232", 3000)) {  // Connect to server
    Serial.println("Connected to server");

    //Send get request for current song data
    client.println("GET /current_song HTTP/1.1");
    client.println("Host: 192.168.0.232");
    client.println("Connection: close");
    client.println();

    //Wait for response
    String response = "";
    while (client.connected() || client.available()) {
      if (client.available()) {
        response = client.readStringUntil('\n');
      }
    }

    client.stop();  //Close connection

    if (response.length() > 0) {
      Serial.println("Response received:");

      //Parse the data
      JSONVar jsonData = JSON.parse(response);

      if (JSON.typeof(jsonData) == "undefined") {
        Serial.println("Parsing failed!");
        return;
      }

      //Remember the current song
      const char* song = (const char*)jsonData["song"];

      if (currentSong != song) { //Check if the current song has changed on this request
        Serial.println(currentSong);
        Serial.println(song);
        currentSong = song;

        const char* artist = (const char*)jsonData["artist"];
        const char* album = (const char*)jsonData["album"];
        const char* albumCover = (const char*)jsonData["album_cover"];

        //Update the screen

        screen.fillScreen(0);
        screen.setCursor(0, 120);
        screen.setTextSize(2);
        screen.println(song);
        screen.setTextSize(2);
        screen.println(artist);
        screen.setTextSize(1);
        screen.println(album);

        drawAlbumCover(albumCover);
      }
    }
  } else {
    Serial.println("Failed to connect to server");
  }
}

void drawAlbumCover(const char* coverURL) {
  // Connect to the server
  if (client.connect("192.168.0.232", 3000)) {
    Serial.println("Connected to image server");

    //Create the url
    client.print("GET /cover?url=");
    client.print(coverURL);  //Send the cover url
    client.println(" HTTP/1.1");
    client.println("Host: 192.168.0.232");
    client.println("Connection: close");
    client.println();

    //Read the headers
    while (client.connected()) {
      String line = client.readStringUntil('\n');
      if (line == "\r") {
        break;  //End of headers
      }
    }

    //Read image data
    uint16_t bitmap[96 * 96];
    int index = 0;

    // Read the response body
    while (client.connected() || client.available()) {
      if (client.available()) {
        uint8_t byte1 = client.read();           //Read first byte
        uint8_t byte2 = client.read();           //Read second byte
        bitmap[index++] = (byte2 << 8) | byte1;  //Combine bytes into 16 bit RGB565 value

        //Ensure we don't overflow the bitmap array
        if (index >= 96 * 96) {
          break;
        }
      }
    }

    //Display at (88, 20)
    screen.drawRGBBitmap(88, 20, bitmap, 96, 96);

    client.stop(); //Close connection
    Serial.println("Image displayed on screen");

  } else {
    Serial.println("Failed to connect to image server");
  }
}
