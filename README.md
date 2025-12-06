# automatron

This is my personal LINE bot that helps me automate various tasks of everyday life, such as
**home control** (air conditioner, lights and plugs) and **expense tracking** (record how much I spend each day).
[See below for a feature tour.](#features)

I recommend every developer to try creating their own personal assistant chat bot.
It’s a great way to practice coding and improve problem solving skills.
And it helps make life more convenient!

It is written in TypeScript and runs on [DigitalOcean App Platform](https://www.digitalocean.com/products/app-platform) with Node.js 24.

## features

- [home automation](#home-automation)
- [expense tracking](#expense-tracking)
- [transaction aggregation](#transaction-aggregation)
- [image-to-text](#image-to-text)
- [livescript evaluation](#livescript-evaluation)

### home automation

![home automation](./images/home_automation.png)

I have a [Home Assistant](https://www.home-assistant.io/) setup which can [control lights](https://www.home-assistant.io/integrations/hue/), [air conditioner](https://www.home-assistant.io/integrations/broadlink/#remote), and [smart plugs](https://www.home-assistant.io/integrations/tplink/). automatron can send commands to [Home Assistant’s REST API](https://developers.home-assistant.io/docs/api/rest/) to control these devices.

### expense tracking

![expense tracking](./images/expense_tracking.png)

Simple expense tracking by typing in the amount + category. Example: 50f means ฿50 for food. Data is saved in [Grist](https://www.getgrist.com/).

On mobile, tapping the bubble’s body (containing the amount) will take me to the created Grist record. This allows me to easily edit or add remarks to the record.

### transaction aggregation

![transaction_aggregation](./images/transaction_aggregation.png)

I built a [notification exfiltrator](https://docs.dt.in.th/dtinth.tools-android/exfiltrate.html) that send notifications my phone receive to automatron, which saves it to a database for later processing.

### image-to-text

![image_to_text](./images/image_to_text.png)

automatron can also convert image to text using [Google Cloud Vision API](https://cloud.google.com/vision/).

### livescript evaluation

![livescript](./images/livescript.png)

[LiveScript](https://livescript.net/) interpreter is included, which allows me to do some quick calculations.

### cli / api

![api](./images/api.png)

`POST /text` sends a text command to automatron. This is equivalent to sending a text message through LINE. This allows me to create a CLI tool that lets me talk to automatron from my terminal.

`POST /post` sends a message to my LINE account directly. This allows the [home automation](#home-automation) scripts to report back to me whenever the script is invoked.

## project structure

- [core](./core) — The core automatron service.
- [webui](./webui) — The web-based UI running on Vercel.

### other projects

- [automatron-prelude](https://github.dev/dtinth/automatron-prelude/blob/main/prelude.js) contains code experimentation.

### development setup

```sh
# Run the development server
pnpm dev

# Set up a tunnel using frp
pnpm tunnel

# Update a secret
pnpm env:set SECRET_NAME
```
