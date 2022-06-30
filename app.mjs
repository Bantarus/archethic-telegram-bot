import archethic from "archethic";
import fetch from "cross-fetch";
import { Telegraf, Markup } from "telegraf";
const randomSecretKey = archethic.randomSecretKey;


// custom modules
import  db from "./lib/src/services/database.mjs"
import {UsersDao} from "./lib/src/services/users_dao.mjs"

// logger
import log from "./lib/src/services/logger.mjs"
import logger from "./lib/src/services/logger.mjs";

// telegraf bot instance
const bot = new Telegraf(process.env.BOT_TOKEN)


// Archethic global variables
const archethicEndpoint = "https://testnet.archethic.net";
const testnetOriginKey = "000118be6f071dafc864008de5e52fb83714c976fcdc4d0aa17205fe54e65c6bc904"
const curveType = "ed25519";

// functionnals global variables
const wallet_button_text = "Wallet";
const Generate_wallet_button_text = "Generate Wallet";



function generatePemText(seed,publicAddress){
  const { privateKey }  = archethic.deriveKeyPair(seed,0);
  var pemText = "-----BEGIN PRIVATE KEY for " + publicAddress + "-----" + "\n";
  pemText+= Buffer.from(privateKey).toString('base64').replace(/.{64}/g, '$&\n') + "\n";
  pemText+= "-----END PRIVATE KEY for "+ publicAddress + "-----";

  return Buffer.from(pemText);
  
  
  
}



function getUCOBalance(publicAddress){


  return fetch(archethicEndpoint + "/api", {
    method: "POST",
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      query: `query {
                  balance(address: "${publicAddress}"){
                    uco
                  }
              }`
    })
  })
  .then(r => r.json())
  .then((res) =>{
    if (res.data == null) {
      console.log("res.data is null")
      return 0;
    } else {
      console.log(res.data.balance.uco)
      return res.data.balance.uco;
    }
  });

 
  
}



bot.command('quit', (ctx) => {
  // Explicit usage
  ctx.telegram.leaveChat(ctx.message.chat.id)
  .catch(error => logger.error(error))
    
  


  // Using context shortcut
  // ctx.leaveChat()
})

bot.command('start', ctx => {
  var userId = ctx.message.from.id
  db.read()
  if (!db.data.users.some(user => user.id === userId )){
    db.data.users.push({ id : userId})
    db.write()
  }else{
    console.log("Welcome back:" + userId)
  }
  
  ctx.telegram.sendMessage(ctx.message.chat.id, "Home",  Markup.keyboard([["Wallet"],["Help","About"]])
  ).catch(error => logger.error(error))
})

bot.hears("Wallet", ctx =>{
  var userId = ctx.message.from.id
  var user = UsersDao.getById(userId)

  if (user === undefined) {
    return ctx.telegram.sendMessage(ctx.message.chat.id, `🤖: You are not registered with me. 🛑`)
      .catch(error => logger.error(error))
  }

  if (!user.hasOwnProperty('wallet')) {

    return ctx.telegram.sendMessage(ctx.message.chat.id, "Wallet",
      Markup.keyboard([[Generate_wallet_button_text], ["Back"]]))
      .catch(error => logger.error(error))

  }

   var walletTextToDraw = user.wallet.substring(0,4) + "..." + user.wallet.substring(user.wallet.length-4,user.wallet.length)


  var keyboardObject = [
    ["👛 Wallet : " + walletTextToDraw],
    ["▶️ Manage"],
    ["🏠 Back"]
  ]
  
  return ctx.telegram.sendMessage(ctx.message.chat.id, "Wallet generated.",
    Markup.keyboard(keyboardObject))
    .catch(error => logger.error(error))


})


bot.hears("▶️ Manage", async ctx => {

  var textReply = "💰 Wallet balance : ";
  try{
    var balance =  await getUCOBalance(user.wallet)
    textReply+= balance + " UCO\n"

  }catch(error){
    textReply+= "Unavailable"
    logger.error(error);
  }
 
  

  var inlineKeyboardReply = [
    [{ text : "💸 Send", callback_data : "some data"},{ text : "📨 Receive" , callback_data : "some data"}],
    [{ text : "🔧 Backup seed", callback_data : "some data"}]
    
  ]

  try {
    return await ctx.telegram.sendMessage(ctx.message.chat.id, textReply,
      Markup.inlineKeyboard(inlineKeyboardReply));
  } catch (error) {
    logger.error(error);
    return await ctx.telegram.sendMessage(ctx.message.chat.id, "Management keyboard not accessible.");

  }
})



bot.hears(Generate_wallet_button_text, ctx =>{

  var userId = ctx.message.from.id
  var chatId = ctx.message.chat.id;
  var seed = randomSecretKey();
  var index = 0;

  var publicAddress = archethic.deriveAddress(seed,index)
  

  var user = UsersDao.getById(userId);
  user.wallet = publicAddress;
  user.seed = seed.toString();
  db.write()
  var pemTextBuffer = generatePemText(seed,publicAddress);

  
  ctx.replyWithDocument({source: pemTextBuffer , filename: publicAddress + ".pem" })
  .catch(error => logger.error(error))

  ctx.telegram.sendMessage(ctx.message.chat.id, "Wallet generated : ")
  .catch(error => logger.error(error))
  ctx.telegram.sendMessage(ctx.message.chat.id, publicAddress,
    Markup.keyboard([["Wallet : " + publicAddress.toString()],["Back"]]))
    .catch(error => logger.error(error))
})

bot.hears("🏠 Back", ctx => {
  ctx.telegram.sendMessage(ctx.message.chat.id, "Home",  Markup.keyboard([["Wallet"],["Help","About"]]))
  .catch(error => logger.error(error))
})

bot.hears("Help", ctx => {
  ctx.telegram.sendMessage(ctx.message.chat.id, "I'm here to help you set your archethic wallet.")
  .catch(error => logger.error(error))
})

bot.hears("About", ctx => {
  ctx.telegram.sendMessage(ctx.message.chat.id, "Telegram bot done with Telegraf and Archethic javascript libraries.")
  .catch(error => logger.error(error))
})



// tip listener
const regex = /^!tip \d+,*\d{0,16}/;
bot.hears(regex, async ctx => {
  var rgx = /\d+,*\d{0,16}/;
  var tipValue = rgx.exec(ctx.message.text);
  var user = UsersDao.getById(ctx.message.from.id)
  var userBalance = await getUCOBalance(user.wallet).catch(error => {return 0})



  if(user === undefined ){
    
    return ctx.telegram.sendMessage(ctx.message.chat.id, `🤖: Unknown life form : @${ctx.message.from.username}. 🛑`)
    .catch(error => logger.error(error));
  }

  if (ctx.message.reply_to_message?.from?.id === undefined) {
    return ctx.telegram.sendMessage(ctx.message.chat.id, `🤖: Hey @${ctx.message.from.username}, you can tip by replying to another user. 🛑`)
    .catch(error => logger.error(error));
  }

  if (tipValue > userBalance){
    return ctx.telegram.sendMessage(ctx.message.chat.id, `🤖: Hey @${ctx.message.from.username}, waiting for payday ? Insufficients funds. 🛑`)
    .catch(error => logger.error(error));
  }

  var recipientID = ctx.message.reply_to_message.from.id
  var recipientUser = UsersDao.getById(recipientID)

  if (recipientUser === undefined) {
    return ctx.telegram.sendMessage(ctx.message.chat.id, `🤖:@${ctx.message.reply_to_message.from.username} is not registered with me ! 🛑`)
    .catch(error => logger.error(error));
  }

  if(recipientID === user.id){
    return ctx.telegram.sendMessage(ctx.message.chat.id, `🤖: I will not work for nothing ! @${ctx.message.from.username} is tipping himself... 🛑`)
    .catch(error => logger.error(error));
  }

  

  var recipientUser = UsersDao.getById(recipientID)

  archethic.getTransactionIndex(address, archethicEndpoint
    .then((index) => {
      var tx = archethic.newTransactionBuilder("transfer")
        .addUCOTransfer(recipientUser.wallet, parseFloat(tipValue[0]))
        .build(user.seed, index)
        .originSign(testnetOriginKey)

      console.log(tx.toJSON())

      try {

        archethic.sendTransaction(tx, archethicEndpoint)
        .catch(error => logger.error(error))

        ctx.telegram.sendMessage(ctx.message.chat.id, `🤖: @${ctx.message.from.username} sent ${tipValue[0]} to @${ctx.message.reply_to_message.from.username} ! 💸`)
        .catch(error => logger.error(error));


      } catch (error) {
        logger.error(error)
      }
    }

    )

  )




})

/*
bot.on('text', (ctx) => {
  // Explicit usage
  ctx.telegram.sendMessage(ctx.message.chat.id, `Hello ${ctx.state.role}`)

  // Using context shortcut
  //ctx.reply(`Hello ${ctx.state.role}`)
})*/

bot.on('callback_query', (ctx) => {
  // Explicit usage
  ctx.telegram.answerCbQuery(ctx.callbackQuery.id)

  // Using context shortcut
  //ctx.answerCbQuery()
})

bot.on('inline_query', (ctx) => {
  const result = []
  // Explicit usage
  ctx.telegram.answerInlineQuery(ctx.inlineQuery.id, result)

  // Using context shortcut
  // ctx.answerInlineQuery(result)
})

bot.launch()

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
