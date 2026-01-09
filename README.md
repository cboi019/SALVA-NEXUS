# 🔗 Salva Nexus
### On-Chain Payment Infrastructure for the Next Billion

Salva Nexus is a premier on-chain financial protocol designed specifically for the Nigerian economy. By leveraging the **Base (Layer 2)** network and **ERC-4337 Account Abstraction**, Salva provides a frictionless, "gasless" experience for everyday Naira-referenced payments.

---

## 🏗 System Architecture

Salva Nexus utilizes a hybrid architecture that combines traditional Web2 reliability with Web3 transparency.



```mermaid
graph TD
    User((User)) -->|Requests OTP| Backend[Node.js Express API]
    Backend -->|SMTP| Gmail[Gmail SMTP Server]
    Gmail -->|Email| User
    
    User -->|Initiates Transfer| Backend
    Backend -->|Relays Meta-Tx| Gelato[Gelato Relay/Paymaster]
    Gelato -->|Sponsors Gas| Base[Base Layer 2]
    
    subgraph Blockchain
    Base -->|Interacts| Safe[Safe Smart Wallet]
    Base -->|Updates| Registry[On-Chain Registry]
    Base -->|Transfers| NGNs[NGNs Stablecoin]
    end
    
    Backend -->|Stores Data| MongoDB[(MongoDB Atlas)]
Core Components:Smart Identity (Safe/ERC-4337): Every user is assigned a Smart Contract Wallet (Safe) upon registration. This allows for multi-sig security and social recovery.

Relay Service (Gelato): Acts as the Paymaster, sponsoring gas fees so users can transact without needing ETH.

On-Chain Registry: Maps traditional user identifiers (like mobile numbers or account IDs) to complex blockchain addresses.

NGNs Token: A 1:1 Naira-referenced stablecoin on Base.🔐 Smart Wallets & Account AbstractionUnlike traditional wallets (like MetaMask) where a lost private key means lost funds, Salva uses Account Abstraction.FeatureTraditional EOASalva Smart WalletGas FeesMust hold ETH/Native tokensSponsored (Zero Gas)RecoverySeed Phrase OnlyOTP / Email RecoverySimplicityComplex Hex AddressesAccount Number MappingSecuritySingle Point of FailureProgrammable Logic (Safe)✨

BenefitsZero Friction: Users don't need to know what a "gas fee" is. They just send and receive.

Naira Stability: Avoid the volatility of crypto. 1 NGNs = 1 NGN.

Instant Settlement: Payments settle in seconds on the Base network, 24/7.

Mobile-First Design: Engineered for the Nigerian mobile user, with OTP-based security and account number identifiers.🚀 

Getting Started: 
Backend Setup - cd packages/backend - npm install - node src/index.js
Frontend Setup - cd packages/frontend - npm install - npm start


© 2026 Salva NEXUS LTD. All Rights Reserved.