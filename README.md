# Simple insurance claims project. 

## It contains the following features:

* Simple auth through registering an account, logging in via credentils and also via google Oauth.
* POSTing an insurance claim.
* Fetching an insurance claim and getting the status

### The schema does mimic Kenyan healthcare systems to the best of my knowledge.

## Tech Stack:
* PostgreSQL - Great DBMS that I'm very familiar with. 
* Fastify - It is typescript-first and schema definition is made easier for swagger documentation. It is also actively maintained. 
* Drizzle ORM - I've always preferred Drizzle to other ORM's like Prisma. Drizzle is much closer to SQL and is richer in regards to native features. 

## In Production, I would improve on:
* Auth would have proper activation through verifying emails or phone numbers through background processes.
* The database would have targeted indexes and optimized for scale.
* Tests. End to end testing.
* Do proper logging. Use a SAAS like logzio to manage logging.
* Dockerize the application

## How to run it locally
* `npm install`
* Create a .env file in the root folder with the following variables
+ `DATABASE_URL=postgresql://postgres:postgres@localhost:{{LOCAL_PORT}}/{{DB_NAME}}?schema=public`
+ `GOOGLE_CLIENT_ID=""`
+ `GOOGLE_CLIENT_SECRET=""`
+ `JWT_SIGN_PRIVATE_KEY=""`
+ `PORT={{PORT}}`

* Generate drizzle schema `npx drizzle-kit generate`
* Migrate drizzle schema `npx drizzle-kit migrate`

* Start the app
`npm start`

* Access the localhost and use the port set in the env variable to access the swagger documentation. For example if port us 3094 and locahlost is 127.0.0.1, access through `http://127.0.0.1:3094/docs`
