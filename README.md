# POC TEMPLATE

This repo is a template POC, that will be used for initializing future POCs easier.

### Directories structure

- move:
    - Contains the Move code of the smart contracts
    - Contains a sample package named `poc` where the developer can add a move module and start building

- app
    - Contains a Typescript React App, boostrapped with Vite, with ready-to-use:
        - three different user roles
        - routing based on the permissions of the current user
        - Sui typescript SDK integration
        - Sui Wallet connection
        - environment variables file reading via custom hook useConfig

- setup
    - A Typescript project, with ready-to-use:
        - environment variable (.env) file reading
        - Sui SDK integration
        - publish shell script
