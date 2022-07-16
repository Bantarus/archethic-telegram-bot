import archethic from "archethic";
import fetch from "cross-fetch";
import { Telegraf, Markup, Scenes} from "telegraf";
import LocalSession from 'telegraf-session-local'
import  QRCode  from "qrcode";

const randomSecretKey = archethic.randomSecretKey;




// custom modules
import  db from "./lib/src/services/database.mjs"
import {UsersDao} from "./lib/src/services/users_dao.mjs"

// logger
import log from "./lib/src/services/logger.mjs"
import logger from "./lib/src/services/logger.mjs";
//import { Stage, WizardScene } from "telegraf/typings/scenes/index.js";

// telegraf bot instance
const token = process.env.BOT_TOKEN
if (token === undefined) {
  throw new Error('BOT_TOKEN must be provided!')
}

const bot = new Telegraf(token)


// Archethic global variables
const archethicEndpoint = "https://testnet.archethic.net";
const testnetOriginKey = "01019280BDB84B8F8AEDBA205FE3552689964A5626EE2C60AA10E3BF22A91A036009"
const curveType = "ed25519";

// functionnals global variables
const WALLET_BUTTON_TEXT = "Wallet";
const GENERATE_WALLET_BUTTON_TEXT = "👛 Generate Wallet";
const CALLBACK_DATA_SEND = "send"
const CALLBACK_DATA_RECEIVE = "receive"
const CALLBACK_DATA_BACKUP_SEED = "seed"
const SEND_WIZARD_SCENE_ID = "SEND_WIZARD"


function generatePemText(seed,publicAddress){
  const { privateKey }  = archethic.deriveKeyPair(seed,0);
  var pemText = "-----BEGIN PRIVATE KEY for " + publicAddress + "-----" + "\n";
  pemText+= Buffer.from(privateKey).toString('base64').replace(/.{64}/g, '$&\n') + "\n";
  pemText+= "-----END PRIVATE KEY for "+ publicAddress + "-----";

  return Buffer.from(pemText);
  
  
  
}


function seedStringToUint8Array(seed){

  var seedUint8Array = new Uint8Array(seed.split(",").map( i => parseInt(i)));

  return seedUint8Array;
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

// start - Let's begin your transactionchain journey !
bot.command('start', ctx => {

  if(ctx.message.chat.type !== "private"){
    return ctx.telegram.sendMessage(ctx.message.chat.id, `🤖: We should take a private room to do this.\n Open a private chat with @${ctx.botInfo.username} to start interacting with him.`)
    .catch(error => logger.error(error));
  }

  var userId = ctx.message.from.id
  db.read()
  if (!db.data.users.some(user => user.id === userId )){
    db.data.users.push({ id : userId})
    db.write()
  }else{
    console.log("Welcome back:" + userId)
  }
  
  ctx.telegram.sendMessage(ctx.message.chat.id, "Home",  Markup.keyboard([["👛 Wallet"],["🦮 Help","📖 About"]])
  ).catch(error => logger.error(error))
})

bot.hears("👛 Wallet", ctx =>{
  var userId = ctx.message.from.id
  var user = UsersDao.getById(userId)

  if (user === undefined) {
    return ctx.telegram.sendMessage(ctx.message.chat.id, `🤖: You are not registered with me. 🛑`)
      .catch(error => logger.error(error))
  }

  if (!user.hasOwnProperty('wallet')) {

    return ctx.telegram.sendMessage(ctx.message.chat.id, "Wallet",
      Markup.keyboard([[GENERATE_WALLET_BUTTON_TEXT], ["Back"]]))
      .catch(error => logger.error(error))

  }

   var walletTextToDraw = user.wallet.substring(0,4) + "..." + user.wallet.substring(user.wallet.length-4,user.wallet.length)


  var keyboardObject = [
    ["👛 Wallet : " + walletTextToDraw],
    ["▶️ Play"],
    ["🏠 Back"]
  ]
  
  return ctx.telegram.sendMessage(ctx.message.chat.id, "Wallet generated.",
    Markup.keyboard(keyboardObject))
    .catch(error => logger.error(error))


})


bot.hears(GENERATE_WALLET_BUTTON_TEXT, ctx =>{

  var userId = ctx.message.from.id
  var chatId = ctx.message.chat.id;
  var seed = randomSecretKey();
  var index = 0;

  var publicAddress = archethic.deriveAddress(seed,index)
  


  var user = UsersDao.getById(userId);
  if(user === undefined ){
    
    return ctx.telegram.sendMessage(ctx.message.chat.id, `🤖: Unknown life form : ${ctx.message.from.first_name}. 🛑`)
    .catch(error => logger.error(error));
  }

  user.wallet = publicAddress;
  user.seed = seed.toString()
  db.write()
  
  //var pemTextBuffer = generatePemText(seed,publicAddress);
  //ctx.replyWithDocument({source: pemTextBuffer , filename: publicAddress + ".pem" })
  //.catch(error => logger.error(error))

  var walletTextToDraw = user.wallet.substring(0,4) + "..." + user.wallet.substring(user.wallet.length-4,user.wallet.length)


  var keyboardObject = [
    ["👛 Wallet : " + walletTextToDraw],
    ["▶️ Play"],
    ["🏠 Back"]
  ]

  ctx.telegram.sendMessage(ctx.message.chat.id, "Wallet generated :")
    .catch(error => logger.error(error))

  ctx.telegram.sendMessage(ctx.message.chat.id, publicAddress,
    Markup.keyboard(keyboardObject))
    .catch(error => logger.error(error))
})



bot.hears("▶️ Play", async ctx => {
  var userId = ctx.message.from.id
  var user = UsersDao.getById(userId)
  var seedUint8Array = seedStringToUint8Array(user.seed)
  
  var textReply = "💰 Wallet balance : ";
  try{
    var index = await archethic.getTransactionIndex(user.wallet, archethicEndpoint)
    var lastAddress = archethic.deriveAddress(seedUint8Array,index)
    var balance =  await getUCOBalance(lastAddress)
    textReply+= balance + " UCO\n"

  }catch(error){
    textReply+= "Unavailable"
    logger.error(error);
  }
 
  

  var inlineKeyboardReply = [
    [{ text : "💸 Send", callback_data : CALLBACK_DATA_SEND},{ text : "📨 Receive" , callback_data : CALLBACK_DATA_RECEIVE}],
    [{ text : "🔑 Backup seed", callback_data : "some data"}]
    
  ]

  try {
    return await ctx.telegram.sendMessage(ctx.message.chat.id, textReply,
      Markup.inlineKeyboard(inlineKeyboardReply));
  } catch (error) {
    logger.error(error);
    return await ctx.telegram.sendMessage(ctx.message.chat.id, "Management keyboard not accessible.");

  }
})



bot.hears("🏠 Back", ctx => {
  ctx.telegram.sendMessage(ctx.message.chat.id, "Home",  Markup.keyboard([["👛 Wallet"],["🦮 Help","📖 About"]]))
  .catch(error => logger.error(error))
})


const HELP_TEXT = `I'm here to help you set your archethic wallet.

Begin with the <b>/start</b> command to register with me.

Then generate your wallet with the [👛 Wallet] button from the Home keyboard.

Finally invoke the play keyboard by clicking on the [▶️ Play] button to interact with your wallet.

You can also tips others users in group chat by replying to them with the <b>/tip</b> command with the <b>UCO amount</b> to send as <b>argument</b>.` 


bot.command("help", ctx => {
  if(ctx.message.chat.type !== "private"){
    return ctx.telegram.sendMessage(ctx.message.chat.id, `🤖: We should take a private room to do this.\n Open a private chat with @${ctx.botInfo.username} to start interacting with me.`)
    .catch(error => logger.error(error));
  }
  ctx.telegram.sendMessage(ctx.message.chat.id, HELP_TEXT,{ parse_mode: "HTML"})
  .catch(error => logger.error(error))
})

bot.hears("🦮 Help", ctx => {
  ctx.telegram.sendMessage(ctx.message.chat.id, HELP_TEXT,{ parse_mode: "HTML"})
  .catch(error => logger.error(error))
})

bot.hears("📖 About", ctx => {
  ctx.telegram.sendMessage(ctx.message.chat.id, "Telegram bot done with Telegraf and Archethic javascript libraries.")
  .catch(error => logger.error(error))
})




// send action scene
const sendWizard = new Scenes.WizardScene(SEND_WIZARD_SCENE_ID,
  (ctx) => {

    //ctx.reply("Which is the recipient public address ?")
    ctx.editMessageText("Which is the recipient public address ?",{reply_markup: ctx.update.callback_query.message.reply_markup})
    .catch(error => error => logger.error(error))
 
   
    ctx.wizard.state.sendData = {reply_markup: ctx.update.callback_query.message.reply_markup,
                                message_id: ctx.update.callback_query.message.message_id}

    return ctx.wizard.next();

  },
  (ctx) => {
    try {


      ctx.wizard.state.sendData.to = ctx.message.text



      //ctx.reply("UCO amount to send ?")
      ctx.telegram.editMessageText(ctx.chat.id, ctx.wizard.state.sendData.message_id, undefined, "UCO amount to send ?", { reply_markup: ctx.wizard.state.sendData.reply_markup })
        .catch(error => error => logger.error(error))


      return ctx.wizard.next();
    } catch (error) {

      logger.error(error)
      return ctx.scene.leave();
    }
    

  },
  async (ctx) => {

    try {

      if (isNaN(Number(ctx.message.text))) {
        return ctx.telegram.editMessageText(ctx.chat.id, ctx.wizard.state.sendData.message_id, undefined,`Invalid amount ! ❌`, { reply_markup: ctx.wizard.state.sendData.reply_markup })
          .catch(error => logger.error(error));
      }

      var userId = ctx.message.from.id
      var user = UsersDao.getById(userId)
      var seedUint8Array = seedStringToUint8Array(user.seed)
      var index = await archethic.getTransactionIndex(user.wallet, archethicEndpoint)
      var lastAddress = archethic.deriveAddress(seedUint8Array,index)
      var balance = await getUCOBalance(lastAddress)

      if (Number(ctx.message.text) > balance) {
        return ctx.telegram.editMessageText(ctx.chat.id, ctx.wizard.state.sendData.message_id, undefined,`Insufficient funds ! ❌`, { reply_markup: ctx.wizard.state.sendData.reply_markup })
          .catch(error => logger.error(error));
      }


      ctx.wizard.state.sendData.amount = ctx.message.text
      let textReply = "Send to : " + ctx.wizard.state.sendData.to + "\n"
      textReply += "Amount : " + ctx.wizard.state.sendData.amount + " UCO" + "\n"
      textReply += "Do you confirm ? NO|YES"

      ctx.telegram.editMessageText(ctx.chat.id, ctx.wizard.state.sendData.message_id, undefined,textReply, { reply_markup: ctx.wizard.state.sendData.reply_markup })
        .catch(error => logger.error(error));
      return ctx.wizard.next();
    }
    catch(error){
      logger.error(error)
      return ctx.scene.leave();
    }

  },
  async (ctx) => {

    // if YES
    // sign transfert on chain 
    //
      try {
        if(ctx.message.text === "YES"){
      var user = UsersDao.getById(ctx.message.from.id);
      var seedUint8Array = seedStringToUint8Array(user.seed)
      

      var originKey = archethic.getOriginKey()

      archethic.getTransactionIndex(user.wallet, archethicEndpoint)
        .then((index) => {
          var tx = archethic.newTransactionBuilder("transfer")
            .addUCOTransfer(ctx.wizard.state.sendData.to, parseFloat(ctx.wizard.state.sendData.amount))
            .build(seedUint8Array, index)
            .originSign(originKey)
    
          console.log(tx.toJSON())
    
         

          archethic.sendTransaction(tx, archethicEndpoint)
            .then(r => {
              ctx.telegram.editMessageText(ctx.chat.id, ctx.wizard.state.sendData.message_id, undefined, `🤖: UCO sent ! 💸`
                , { reply_markup: ctx.wizard.state.sendData.reply_markup })
                .catch(error => logger.error(error));
            }


            )
            .catch(error => error => logger.error(error))
    
            
    
    
          
        }
    
        ).catch(error => error => logger.error(error))
    
      }else{
        ctx.telegram.editMessageText(ctx.chat.id, ctx.wizard.state.sendData.message_id, undefined,`Transfert cancelled. ❌`
        , { reply_markup: ctx.wizard.state.sendData.reply_markup })
      .catch(error => logger.error(error));
      return ctx.scene.leave();
      }

    } catch (error) {
      logger.error(error)
    }
    finally{

      return ctx.scene.leave();
    }
    
    
    
    
  })

// add send wizard scene to a middleware
const stage = new Scenes.Stage([sendWizard]);
// register before using enter 

bot.use(new LocalSession({}).middleware())
bot.use(stage.middleware()) 

// send inline button action to enter scene

bot.action(CALLBACK_DATA_SEND, Scenes.Stage.enter(SEND_WIZARD_SCENE_ID,) ) // ctx => ctx.scene.enter(SEND_WIZARD_SCENE_ID))



// CALLBACK RECEIVE

bot.action(CALLBACK_DATA_RECEIVE, async ctx => {

 var user = UsersDao.getById(ctx.callbackQuery.from.id)

 if(user === undefined ){
    
  return ctx.reply(`🤖: Unknown life form : ${ctx.callbackQuery.from.first_name} 🛑`)
  .catch(error => logger.error(error));
}

 var address = user.wallet
 
  var qrCodeBuffer = await QRCode.toBuffer(address)
  ctx.replyWithPhoto({ source: qrCodeBuffer, filename: 'qrcode' , type:'multipart/form-data' })
  .catch(error => error => logger.error(error))

  var qrTextUpdate = "You can use the qrcode below or click on your public address to copy it : `" + address + "` \n"
  

  ctx.editMessageText(qrTextUpdate,{reply_markup: ctx.update.callback_query.message.reply_markup, parse_mode: "MarkdownV2"})
  .catch(error => error => logger.error(error))
 
 

} ) 



// tip handler
//const regex = /^!tip (\d+,\d{1,16}|\d+)/;
// using command instead of hears to keep privacy mode ON in groups
// /tip <amount> Use this to send UCO to the user you are replying to
bot.command('tip', async ctx => {
//bot.hears(regex, async ctx => {
 
  var rgx = /(\d+,\d{1,16}|\d+)/;
  var tipValue = rgx.exec(ctx.message.text.substring(5));
  var user = UsersDao.getById(ctx.message.from.id)
  
  

  if(user === undefined ){
    
    return ctx.telegram.sendMessage(ctx.message.chat.id, `🤖: Unknown life form : ${ctx.message.from.first_name}. 🛑`)
    .catch(error => logger.error(error));
  }

  

  if (ctx.message.reply_to_message?.from?.id === undefined) {
    return ctx.telegram.sendMessage(ctx.message.chat.id, `🤖: Hey ${ctx.message.from.first_name}, you can tip by replying to another user. 🛑`)
    .catch(error => logger.error(error));
  }

  

  if(isNaN(Number(tipValue[0]))){
    return ctx.telegram.sendMessage(ctx.message.chat.id, `🤖: Invalid Number. 🛑`)
    .catch(error => logger.error(error));
  }

  var index = await archethic.getTransactionIndex(user.wallet, archethicEndpoint)
  var seedUint8Array = seedStringToUint8Array(user.seed)
  var lastAddress = archethic.deriveAddress(seedUint8Array,index)

  var userBalance = await getUCOBalance(lastAddress)
  .catch(error => {
    logger.error(error)
    return 0})


  if (tipValue[0] > userBalance){
    return ctx.telegram.sendMessage(ctx.message.chat.id, `🤖: Hey ${ctx.message.from.first_name}, waiting for payday ? Insufficients funds. 🛑`)
    .catch(error => logger.error(error));
  }

  var recipientID = ctx.message.reply_to_message.from.id
  var recipientUser = UsersDao.getById(recipientID)

  if (recipientUser === undefined) {
    return ctx.telegram.sendMessage(ctx.message.chat.id, `🤖: ${ctx.message.reply_to_message.from.first_name} is not registered with me ! 🛑`)
    .catch(error => logger.error(error));
  }

  if (recipientUser.wallet === undefined) {
    return ctx.telegram.sendMessage(ctx.message.chat.id, `🤖: ${ctx.message.reply_to_message.from.first_name} has not generated a wallet ! 🛑`)
    .catch(error => logger.error(error));
  }

  if(recipientID === user.id){
    return ctx.telegram.sendMessage(ctx.message.chat.id, `🤖: You are wasting my time ! ${ctx.message.from.first_name} is tipping himself... 🛑`)
    .catch(error => logger.error(error));
  }

  

  var recipientUser = UsersDao.getById(recipientID)

  

 
  var tx = archethic.newTransactionBuilder("transfer")
    .addUCOTransfer(recipientUser.wallet, parseFloat(tipValue[0]))
    .build(seedUint8Array, index)
    .originSign(testnetOriginKey)

  console.log(tx.toJSON())

  try {

    archethic.sendTransaction(tx, archethicEndpoint)

    ctx.telegram.sendMessage(ctx.message.chat.id, `🤖: ${ctx.message.from.first_name} sent ${tipValue[0]} to ${ctx.message.reply_to_message.from.first_name} ! 💸`)



  } catch (error) {
    logger.error(error)
  }




  
})

/*
bot.on('text', (ctx) => {
  // Explicit usage
  ctx.telegram.sendMessage(ctx.message.chat.id, `Hello ${ctx.state.role}`)

  // Using context shortcut
  //ctx.reply(`Hello ${ctx.state.role}`)
})
*/
bot.on('callback_query', (ctx) => {
  // Explicit usage
  ctx.telegram.answerCbQuery(ctx.callbackQuery.id)
  .catch(error => logger.error(error));

  console.log(ctx.callbackQuery.data)
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
