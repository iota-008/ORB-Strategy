[![Javascript](https://camo.githubusercontent.com/3aaee8bf7885dcf0cea8a5647c4514b7d800b1a730d38bce7dadf6bff883378d/68747470733a2f2f696d672e736869656c64732e696f2f7374617469632f76313f7374796c653d666f722d7468652d6261646765266d6573736167653d4a61766153637269707426636f6c6f723d323232323232266c6f676f3d4a617661536372697074266c6f676f436f6c6f723d463744463145266c6162656c3d)](https://github.com/tterb/atomic-design-ui/blob/master/LICENSEs)
[![React](https://camo.githubusercontent.com/67a01fa7cf337616274f39c070a11638f2e65720e414ef55b8dd3f9c2a803b2a/68747470733a2f2f696d672e736869656c64732e696f2f7374617469632f76313f7374796c653d666f722d7468652d6261646765266d6573736167653d526561637426636f6c6f723d323232323232266c6f676f3d5265616374266c6f676f436f6c6f723d363144414642266c6162656c3d)](https://github.com/tterb/atomic-design-ui/blob/master/LICENSEs)
[![Node.js](https://camo.githubusercontent.com/faec9d89bd2c7d47b91d988dcd0f27011c27e8191d45836cfa36bf2b3c2a92bd/68747470733a2f2f696d672e736869656c64732e696f2f7374617469632f76313f7374796c653d666f722d7468652d6261646765266d6573736167653d4e6f64652e6a7326636f6c6f723d333339393333266c6f676f3d4e6f64652e6a73266c6f676f436f6c6f723d464646464646266c6162656c3d)](https://github.com/tterb/atomic-design-ui/blob/master/LICENSEs)
[![Express.js](https://camo.githubusercontent.com/0a95585d6b3a07028298a45d60b85a1331358bc336549d64dbbc27977f1495f3/68747470733a2f2f696d672e736869656c64732e696f2f7374617469632f76313f7374796c653d666f722d7468652d6261646765266d6573736167653d4578707265737326636f6c6f723d303030303030266c6f676f3d45787072657373266c6f676f436f6c6f723d464646464646266c6162656c3d)](https://github.com/tterb/atomic-design-ui/blob/master/LICENSEs)
[![Socket.io](https://camo.githubusercontent.com/3cd61d131f627e41a6a6fe60589cc07578949753809967d9fc36dc6e3e445f25/68747470733a2f2f696d672e736869656c64732e696f2f7374617469632f76313f7374796c653d666f722d7468652d6261646765266d6573736167653d536f636b65742e696f26636f6c6f723d303130313031266c6f676f3d536f636b65742e696f266c6f676f436f6c6f723d464646464646266c6162656c3d
)](https://github.com/tterb/atomic-design-ui/blob/master/LICENSEs)


# IntraTrade

IntraTrade is an application which uses ORB(Opening Range Breakout Strategy) to suggest buy/sell/hold for the stocks.
For first 15 minutes after the market opening it reads the high and low for that interval.
And after that it uses that data with the algorithm for suggestions.


## Getting the high's and low's of the stocks in first 15 minutes of market opening.

https://user-images.githubusercontent.com/46680697/143286357-533b693a-9fe7-4665-b8c2-2aad8a0a7805.mp4


## Working of strategy after recording the high's and low's and suggesting whether to buy/sell/hold the stock.

https://user-images.githubusercontent.com/46680697/143284844-b335c5e2-ca57-4ca1-8438-7df46eb43741.mp4


## Tech Stack

**Client:** React, Socket.io

**Server:** Node, Express, Socket.io, Kite API

**Languages** Javascript, HTML, CSS


## Installation

Install IntraTrade
It requires the api key and api secret for using the kite api, so use your own.

```bash
  - fork the repo
  - clone from your account
  - change to the cloned directory
  - open dashboard and sever folder in different terminal windows
  - run: npm install
  - start server first and then dashboard on different ports.
  - run: npm start
```

See the project running on localhost :)

    
## Features

- Real time stocks price tracking and suggestions
- Auto tracking of time (starting 15 mins and rest)
- UI suggesting buy/sell/hold realtime



## Deployment

The application is not deployed currently as the api is not free.
Needs to be run in localhost for personal use.
```bash
    git pull origin main
    git add .
    git commit -m "your comment"
    git push origin main
```

## Authors

- [@iota-008](https://www.github.com/iota-008)



* note : The kite account was provided by course instructor/mentor.
