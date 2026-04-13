# 🏠 Smart Home Automation with Safety & Relay Controls

A premium, interactive Smart Home Dashboard built with **Vanilla JavaScript**, **CSS3**, and **HTML5**. This project integrates with **Firebase Realtime Database** to provide real-time monitoring and control of IoT devices and sensors.

![Dashboard Preview](https://img.shields.io/badge/UI-Premium-blueviolet?style=for-the-badge&logo=visual-studio-code)
![Stack](https://img.shields.io/badge/Stack-HTML--CSS--JS-orange?style=for-the-badge)
![Database](https://img.shields.io/badge/Database-Firebase-yellow?style=for-the-badge&logo=firebase)

---

## ✨ Features

- **🌙 Premium Dark Theme**: A high-contrast, modern dark interface optimized for OLED and late-night monitoring.
- **🔊 Interactive Audio**: High-quality sound effects for relay toggles and security alerts.
- **📱 Responsive Design**: Fully optimized for Desktop, Tablet, and Mobile screens.
- **☁️ Real-time Synchronization**: Instant updates from Firebase for all sensors and relays.
- **🛡️ Safety Monitoring**:
  - **MQ2 Gas/Smoke**: Real-time gas level monitoring with danger alerts.
  - **Flame Sensor**: Fire detection with visual and audio warnings.
  - **LDR Sensor**: Ambient light detection with specialized day/night visuals.
  - **Rain Sensor**: Moisture detection with animated rain effects.
- **🌡️ Environment Tracking**: DHT11 Temperature and Humidity monitoring.
- **⏱️ Timer Management**: Schedule relay actions (ON/OFF) based on time and specific days.

---

## 🛠️ Technology Stack

- **Frontend**: Pure HTML5, CSS3 (Custom Variables & Glassmorphism), Vanilla JavaScript.
- **Backend / Real-time**: Firebase Realtime Database.
- **Libraries**:
  - `Moment.js` for time management.
  - `FontAwesome` for iconography.
  - `Google Fonts (Outfit & Inter)` for typography.

---

## 🚀 Setup & Installation

This project is a **Pure Frontend** application. **No Node.js or npm is required.**

### 1. Database Setup
1. Create a project in the [Firebase Console](https://console.firebase.google.com/).
2. Enable **Realtime Database**.
3. Set your rules to `true` (for testing only):
   ```json
   {
     "rules": {
       ".read": true,
       ".write": true
     }
   }
   ```
4. Import your `database.json` or let the hardware/app initialize it.

### 2. Run the Application
1. Download or clone this repository.
2. Open `index.html` directly in any modern web browser.
3. Enter your **Firebase Web API Key** and **Database URL** in the settings panel to connect.

---

## 🔧 Hardware Compatibility

This dashboard is designed to work with an **ESP32** or **ESP8266** running the appropriate firmware to push data to the following Firebase paths:

- `relays/` - Relay states (boolean)
- `DHT11/` - `{Temperature: num, Humidity: num}`
- `Sensors/GasLevel` - Analog value
- `Sensors/Flame` - boolean/string
- `LDR/` - `{Dark: boolean, LightLevel: num}`
- `Rain/` - `{Detected: boolean, Level: num}`

---

## 📝 License
This project is open-source. Feel free to use and modify it for your own Smart Home projects!
