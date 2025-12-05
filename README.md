# Social Aura: An FHE-Encrypted Mobile App for Meaningful Connections 🌐

Social Aura is a groundbreaking mobile application that creates a **FHE-encrypted "social aura"** around a user's physical location, powered by **Zama's Fully Homomorphic Encryption (FHE) technology**. This innovative approach allows users to connect meaningfully with those nearby while maintaining their privacy and security.

## Understanding the Problem

In a world increasingly reliant on digital interactions, the barriers to meaningful offline social connections continue to grow. Many people miss opportunities to engage with like-minded individuals simply due to a lack of awareness of who is nearby and shares similar interests. Traditional social networking apps often sacrifice user privacy, leaving sensitive information exposed and dissuading meaningful connections. Users crave a solution that fosters real-life encounters while respecting their privacy and individuality.

## The FHE Solution

Social Aura leverages Zama's open-source libraries to implement **Fully Homomorphic Encryption**. This allows us to match users based on their encrypted **Decentralized ID (DID)** and interest tags without exposing personal information. When users are near each other, the app detects and privately notifies them of matching interests, encouraging spontaneous, meaningful social interactions. By using FHE, we ensure that user identities remain confidential, allowing them to engage with freedom and confidence.

## Key Features

- **FHE-Encrypted User Interest Tags:** Safeguards user data by encrypting interest tags, ensuring only matched users are aware of shared interests.
- **Homomorphic Execution for Nearby User Matching:** Seamlessly executes the matching process without decrypting personal information.
- **Privacy-Preserving Social Connections:** Facilitates meaningful offline encounters without revealing personal details, acting as a digital icebreaker in the Web3 social space.
- **Radar-style User Scanning:** Intuitive interface that allows users to scan their surroundings for potential matches, receiving notifications when compatible users are nearby.

## Technology Stack

- **Zama FHE SDK**: Primary component for confidential computing.
- **React Native**: For building cross-platform mobile applications.
- **Node.js**: Server-side runtime environment.
- **Express**: Server framework for handling app routes.
- **MongoDB**: Database for storing user profiles and interest tags.

## Directory Structure

```
Social_Aura_Fhe/
│
├─ src/
│  ├─ components/
│  ├─ screens/
│  ├─ services/
│  ├─ utils/
│  └─ App.js
│
├─ .env
├─ package.json
├─ package-lock.json
└─ server/
   ├─ models/
   ├─ routes/
   ├─ controllers/
   └─ utilities/
```

## Installation Guide

To set up Social Aura, first ensure you have **Node.js** installed on your machine. This application also relies on specific dependencies that can be fetched through Node Package Manager (npm).

1. Download the project files directly.
2. Open your terminal and navigate to the project root directory.
3. Install the necessary dependencies by running:

   ```bash
   npm install
   ```

This command will retrieve the required Zama FHE libraries along with other essential packages.

## Build & Run Guide

Once you have installed the necessary dependencies, you can build and run the application using the following commands:

1. To start the development server, execute:

   ```bash
   npm start
   ```

2. To build the application for production, run:

   ```bash
   npm run build
   ```

3. For testing the application, execute:

   ```bash
   npm test
   ```

## Code Example

Here’s a sample code snippet demonstrating how to match users based on their encrypted interest tags:

```javascript
import { matchUsers } from './services/matchingService';

// Example user profiles with FHE-encrypted interest tags
const userA = { id: 'user1', interests: 'encryptedInterestA' };
const userB = { id: 'user2', interests: 'encryptedInterestB' };

const matchingResult = matchUsers(userA, userB);

if (matchingResult.isMatch) {
    console.log(`You have a matching interest with ${userB.id}! 🎉`);
} else {
    console.log(`No matches found with ${userB.id}.`);
}
```

This function utilizes Zama's FHE capabilities to securely assess user interests without compromising their privacy.

## Acknowledgements

### Powered by Zama

We extend our heartfelt gratitude to the Zama team for their pioneering work and open-source tools that make confidential blockchain applications possible. Your commitment to privacy-preserving technology has inspired us to create a platform that fosters genuine human connections without compromising user security.

---

Social Aura is not just an app; it is a movement towards embracing privacy while enhancing social interactions. Join us in redefining social networking with cutting-edge FHE technology and meaningful connections!