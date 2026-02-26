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
