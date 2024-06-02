
import Archethic, { Utils, Crypto } from "@archethicjs/sdk"
import fetch from "cross-fetch";
import { Telegraf, Markup, Scenes} from "telegraf";
import LocalSession from 'telegraf-session-local'
import  QRCode  from "qrcode";
import * as bip39 from "bip39"






// custom modules
import  db from "./lib/src/services/database.mjs"
import {UsersDao} from "./lib/src/services/users_dao.mjs"

// logger
import logger from "./lib/src/services/logger.mjs";
//import { WizardContextWizard } from "telegraf/typings/scenes/index.js";

//import { Stage, WizardScene } from "telegraf/typings/scenes/index.js";

// telegraf bot instance
const token = process.env.BOT_TOKEN
if (token === undefined) {
  throw new Error('BOT_TOKEN must be provided!')
}

const bot = new Telegraf(token)


// Archethic global variables
const archethicEndpoint = "https://testnet.archethic.net";

const originPrivateKey = Utils.originPrivateKey

const curveType = "ed25519";
const archethic = new Archethic(archethicEndpoint);
await archethic.connect();

// functionnals global variables
const WALLET_BUTTON_TEXT = "Wallet";
const GENERATE_WALLET_BUTTON_TEXT = "👛 Generate Wallet";
const CALLBACK_DATA_SEND = "send"
const CALLBACK_DATA_RECEIVE = "receive"
const CALLBACK_DATA_BACKUP = "seed"
const CALLBACK_DATA_SEND_CANCEL = "cancel"
const SEND_WIZARD_SCENE_ID = "SEND_WIZARD"


const INLINE_KEYBOARD_PLAY = [
  [{ text : "💸 Send", callback_data : CALLBACK_DATA_SEND},{ text : "📨 Receive" , callback_data : CALLBACK_DATA_RECEIVE}],
  [{ text : "🔑 Backup recovery phrase", callback_data : CALLBACK_DATA_BACKUP}]
  
]


function generatePemText(seed,publicAddress){
  const { privateKey }  = Crypto.deriveKeyPair(seed,0);
  var pemText = "-----BEGIN PRIVATE KEY for " + publicAddress + "-----" + "\n";
  pemText+= Buffer.from(privateKey).toString('base64').replace(/.{64}/g, '$&\n') + "\n";
  pemText+= "-----END PRIVATE KEY for "+ publicAddress + "-----";

  return Buffer.from(pemText);
  
  
  
}


function seedStringToUint8Array(seed){

  var seedUint8Array = new Uint8Array(seed.split(",").map( i => parseInt(i)));

  return seedUint8Array;
}


// Function to convert Uint8Array seed to mnemonic phrase
function uint8ArrayToMnemonic(uint8ArraySeed) {
  // Convert Uint8Array to Buffer
  const seedBuffer = Buffer.from(uint8ArraySeed);
  // Convert Buffer to mnemonic phrase
  const mnemonic = bip39.entropyToMnemonic(seedBuffer.toString('hex'));
  return mnemonic.split(' ');
}


// base text for the open inlineKeyboard

async function getBaseTextOpenKB(user){
  var seedUint8Array = seedStringToUint8Array(user.seed)
  
  var text = "💰 Wallet balance : ";
  try{
    var index = await archethic.transaction.getTransactionIndex(user.wallet)
    
    var lastAddress = Crypto.deriveAddress(seedUint8Array,index)
    
    const balance =  await archethic.network.getBalance(lastAddress)
    
    text+= balance.uco / 10 ** 8 + " UCO"

  }catch(error){
    text+= "Unavailable"
    logger.error(error);
  }

  return text
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

  if(ctx.message.chat.type !== "private" && !ctx.message.text.includes(ctx.botInfo.username)){
    return;
  }

  if(ctx.message.chat.type !== "private" && ctx.message.text.includes(ctx.botInfo.username) ){
  //  return ctx.telegram.sendMessage(ctx.message.chat.id, `🤖: We should take a private room to do this.\n Open a private chat with @${ctx.botInfo.username} to start interacting with him.`)
   return ctx.reply(`🤖: We should take a private room to do this.\n Open a private chat with @${ctx.botInfo.username} to start interacting with me.`,{
    reply_to_message_id : ctx.message.message_id
   })
  .catch(error => logger.error(error));
  }
  
  



  const userId = ctx.message.from.id
  const username = ctx.message.from.username

  db.read()
  if (!db.data.users.some(user => user.id === userId )){
    db.data.users.push({ id : userId, name : username })
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

  // var walletTextToDraw = user.wallet.substring(0,4) + "..." + user.wallet.substring(user.wallet.length-4,user.wallet.length)


  var keyboardObject = [
    //["👛 Wallet : " + walletTextToDraw],
    ["🔓 Open"],
    ["🏠 Back"]
  ]
  
  return ctx.telegram.sendMessage(ctx.message.chat.id, "Wallet find.",
    Markup.keyboard(keyboardObject))
    .catch(error => logger.error(error))


})


bot.hears(GENERATE_WALLET_BUTTON_TEXT, ctx =>{

  var userId = ctx.message.from.id
  var chatId = ctx.message.chat.id;
  var seed = Crypto.randomSecretKey();
  var index = 0;

  var publicAddress = Crypto.deriveAddress(seed,index)
  


  var user = UsersDao.getById(userId);
  if(user === undefined ){
    
    return ctx.telegram.sendMessage(ctx.message.chat.id, `🤖: Unknown life form : ${ctx.message.from.first_name}. 🛑`)
    .catch(error => logger.error(error));
  }

  user.wallet = Utils.uint8ArrayToHex(publicAddress);
  user.seed = seed.toString()
  db.write()
  
  //var pemTextBuffer = generatePemText(seed,publicAddress);
  //ctx.replyWithDocument({source: pemTextBuffer , filename: publicAddress + ".pem" })
  //.catch(error => logger.error(error))

 // var walletTextToDraw = user.wallet.substring(0,4) + "..." + user.wallet.substring(user.wallet.length-4,user.wallet.length)


  var keyboardObject = [
   // ["👛 Wallet : " + walletTextToDraw],
    ["🔓 Open"],
    ["🏠 Back"]
  ]

  ctx.telegram.sendMessage(ctx.message.chat.id, "Wallet generated :")
    .catch(error => logger.error(error))

  ctx.telegram.sendMessage(ctx.message.chat.id, user.wallet,
    Markup.keyboard(keyboardObject))
    .catch(error => logger.error(error))
})



bot.hears("🔓 Open", async ctx => {
  var userId = ctx.message.from.id
  var user = UsersDao.getById(userId)

  var textReply = await getBaseTextOpenKB(user);

  

  try {
    return await ctx.telegram.sendMessage(ctx.message.chat.id, textReply,
      Markup.inlineKeyboard(INLINE_KEYBOARD_PLAY));
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

Finally invoke the open inline keyboard by clicking on the [🔓 Open] button to interact with your wallet.

You can also tips others users in group chat by using the <b>/tip</b> command as following : 
/tip <b>@username</b> <b>10</b>.` 


bot.command("help", ctx => {

  if(ctx.message.chat.type !== "private" && !ctx.message.text.includes(ctx.botInfo.username)){
    return;
  }

  if(ctx.message.chat.type !== "private" && ctx.message.text.includes(ctx.botInfo.username)){
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
  ctx.telegram.sendMessage(ctx.message.chat.id, `Telegram bot done with Telegraf and Archethic javascript libraries.

                    ⚠️ Disclaimer ⚠️

This bot is for recreational purposes only. Use it with caution. The creator is not responsible for any loss or damage resulting from the use of this bot.
`
  ,{ parse_mode: "HTML"})
  .catch(error => logger.error(error))
})




// send action scene
const sendWizard = new Scenes.WizardScene(SEND_WIZARD_SCENE_ID,
  async (ctx) => {

   
    var userID = ctx.callbackQuery.from.id
    var user = UsersDao.getById(userID)

    ctx.callbackQuery.message.reply_markup
    
    var baseTextReply = await getBaseTextOpenKB(user)
    var replyMarkup = {inline_keyboard: [
      [{ text: "🔙 Back ( Cancel transfert )", callback_data: CALLBACK_DATA_SEND_CANCEL }]
    ]}

    

    var textReply = baseTextReply + "\n🤖: Which is the recipient public address ❔"


    ctx.editMessageText(textReply, {reply_markup: replyMarkup})
      .catch(error => {
        logger.error(error)
       // return ctx.scene.leave()
      })
   

    ctx.wizard.state.sendData = {
      reply_markup: replyMarkup,
      callback_message_id: ctx.update.callback_query.message.message_id,
      base_text: baseTextReply,
      text_reply: textReply,
      last_error: 0,
      current_error:0,
      last_error_count: 0
    }

    return ctx.wizard.next();

  },
  (ctx) => {
    try {
      //Keep track of the message id in session
      ctx.wizard.state.sendData.message_id = ctx.message.message_id
      
      var hasError = false;
      var errorTextReply= ""

      // address validation
      if (!typeof (ctx.message.text) == "string") {
        ctx.wizard.state.sendData.current_error = 1
        errorTextReply = ctx.wizard.state.sendData.base_text + `\n🤖: This address is not a string ! ❌`
        hasError = true;
        
      }

      if (!hasError && !Utils.isHex(ctx.message.text)) {

        ctx.wizard.state.sendData.current_error = 2
        errorTextReply = ctx.wizard.state.sendData.base_text + `\n🤖: This address is not in hexadecimal format ! ❌`
        hasError = true;
      }

      if (!hasError && ctx.message.text.length != 68) {
        ctx.wizard.state.sendData.current_error = 3
        errorTextReply = ctx.wizard.state.sendData.base_text + `\n🤖: Invalid address ! ❌`
        hasError = true;
      }

      // if an error was raised
      if (hasError) {

        if (ctx.wizard.state.sendData.current_error != ctx.wizard.state.sendData.last_error) {
          ctx.wizard.state.sendData.last_error = ctx.wizard.state.sendData.current_error
          ctx.wizard.state.sendData.last_error_count = 1
        } else {
          ctx.wizard.state.sendData.last_error_count++
          errorTextReply += `\n🤖: (Warnings ${ctx.wizard.state.sendData.last_error_count}) ⚠️`

        }

        return ctx.telegram.editMessageText(ctx.chat.id, ctx.wizard.state.sendData.callback_message_id, undefined, errorTextReply,{reply_markup: ctx.wizard.state.sendData.reply_markup} )
          .catch(error => logger.error(error));
      }

      ctx.wizard.state.sendData.to = ctx.message.text

      

      var textReply = ctx.wizard.state.sendData.text_reply + "\n  <i>" + ctx.message.text + "</i>"
      textReply += "\n🤖: UCO amount to send ❔"

      ctx.wizard.state.sendData.text_reply = textReply

      ctx.telegram.editMessageText(ctx.chat.id, ctx.wizard.state.sendData.callback_message_id, undefined, textReply, { reply_markup: ctx.wizard.state.sendData.reply_markup, parse_mode: "HTML" })
        .then(r => {
          // reset error state
          ctx.wizard.state.sendData.last_error = 0
          ctx.wizard.state.sendData.last_error_count = 0
          return ctx.wizard.next();
        })
        .catch(error => {
          logger.error(error)
          let errorTextReply = ctx.wizard.state.sendData.base_text + `\n🤖: Unhandled error : send function not available.❌`
          ctx.telegram.editMessageText(ctx.chat.id, ctx.wizard.state.sendData.callback_message_id, undefined, errorTextReply, { reply_markup: ctx.wizard.state.sendData.reply_markup })
            .catch(error =>  logger.error(error))
            return ctx.scene.leave();
        })

        
    } catch (error) {

      logger.error(error)
      let errorTextReply = ctx.wizard.state.sendData.base_text + `\n🤖: Unhandled error : send function not available.❌`
      ctx.telegram.editMessageText(ctx.chat.id, ctx.wizard.state.sendData.callback_message_id, undefined, errorTextReply, { reply_markup: ctx.wizard.state.sendData.reply_markup })
        .catch(error =>  logger.error(error))
      return ctx.scene.leave();
    } finally {
      if (ctx.wizard.state.sendData.message_id != undefined) {
        // message consumed
        ctx.deleteMessage(ctx.wizard.state.sendData.message_id)
          .catch(error => {
            logger.error(error)
          })
      }
    }
    

  },
  async (ctx) => {

    try {
      //Keep track of the message id in session
      ctx.wizard.state.sendData.message_id = ctx.message.message_id

      if (isNaN(Number(ctx.message.text))) {
        let errorTextReply = ctx.wizard.state.sendData.text_reply + `\n🤖: Invalid amount ! ❌`
        return ctx.telegram.editMessageText(ctx.chat.id, ctx.wizard.state.sendData.callback_message_id, undefined,errorTextReply, { reply_markup: ctx.wizard.state.sendData.reply_markup  , parse_mode: "HTML"})
          .catch(error => logger.error(error));
      }

      var userId = ctx.message.from.id
      var user = UsersDao.getById(userId)
      var seedUint8Array = seedStringToUint8Array(user.seed)
      var index = await archethic.transaction.getTransactionIndex(user.wallet)
      var lastAddress = Crypto.deriveAddress(seedUint8Array,index)
      var balance = await archethic.network.getBalance(lastAddress)

      if (Number(ctx.message.text) > balance.uco / 10 ** 8) {
        let errorTextReply = ctx.wizard.state.sendData.text_reply + `\n🤖: Insufficient funds ! ❌`
        return ctx.telegram.editMessageText(ctx.chat.id, ctx.wizard.state.sendData.callback_message_id, undefined,errorTextReply, { reply_markup: ctx.wizard.state.sendData.reply_markup , parse_mode: "HTML"})
          .catch(error => logger.error(error));
      }


      ctx.wizard.state.sendData.amount = ctx.message.text

      

      var textReply = ctx.wizard.state.sendData.text_reply + `\n ` + ctx.message.text
      textReply += "\n🤖: Do you confirm ? NO|YES"

      ctx.telegram.editMessageText(ctx.chat.id, ctx.wizard.state.sendData.callback_message_id, undefined,textReply, { reply_markup: ctx.wizard.state.sendData.reply_markup , parse_mode: "HTML"})
        .catch(error => logger.error(error));
      return ctx.wizard.next();
    }
    catch(error){
      logger.error(error)
      let errorTextReply = ctx.wizard.state.sendData.base_text + `\n🤖: Unhandled error : send function not available.❌`
      ctx.telegram.editMessageText(ctx.chat.id, ctx.wizard.state.sendData.callback_message_id, undefined, errorTextReply, { reply_markup: ctx.wizard.state.sendData.reply_markup })
        .catch(error =>  logger.error(error))
      return ctx.scene.leave();
    } finally {
      if (ctx.wizard.state.sendData.message_id != undefined) {
        // message consumed
        ctx.deleteMessage(ctx.wizard.state.sendData.message_id)
          .catch(error => {
            logger.error(error)
          })
      }

    }

  },
  async (ctx) => {

    // if YES
    // sign transfert on chain 
    //
    try {
      //Keep track of the message id in session
      ctx.wizard.state.sendData.message_id = ctx.message.message_id
      
      if (ctx.message.text === "YES") {
        
        

        var user = UsersDao.getById(ctx.message.from.id);
        var seedUint8Array = seedStringToUint8Array(user.seed)
        var isConfirmed = false


        archethic.transaction.getTransactionIndex(user.wallet)
          .then((index) => {
            const tx = archethic.transaction.new()
            .setType("transfer")
            .addUCOTransfer(ctx.wizard.state.sendData.to, parseFloat(ctx.wizard.state.sendData.amount * 10 ** 8))
            .build(seedUint8Array, index)
            .originSign(originPrivateKey)
            .on("confirmation", (nbConf, maxConf) => {
              console.log(nbConf, maxConf)
              if (nbConf == maxConf && !isConfirmed){
                isConfirmed = true
                let textReply = ctx.wizard.state.sendData.base_text + `\n🤖: UCO sent ! 💸`
                ctx.telegram.editMessageText(ctx.chat.id, ctx.wizard.state.sendData.callback_message_id, undefined, textReply
                  , Markup.inlineKeyboard(INLINE_KEYBOARD_PLAY))
              }

            })
            ;

            

            console.log(tx.toJSON())



            tx.send();
           








          }

          )

      } else {
        let cancelledText = ctx.wizard.state.sendData.base_text + `\n🤖: Transfert cancelled. ❌`
        ctx.telegram.editMessageText(ctx.chat.id, ctx.wizard.state.sendData.callback_message_id, undefined, cancelledText
          , Markup.inlineKeyboard(INLINE_KEYBOARD_PLAY))

        return ctx.scene.leave();
      }

    } catch (error) {
      logger.error(error)
      let errorTextReply = ctx.wizard.state.sendData.base_text + `\n🤖: Unhandled error : send function not available. ❌`
      ctx.telegram.editMessageText(ctx.chat.id, ctx.wizard.state.sendData.callback_message_id, undefined, errorTextReply, { reply_markup: ctx.wizard.state.sendData.reply_markup })
        .catch(error => logger.error(error))
    }
    finally {
      if (ctx.wizard.state.sendData.message_id != undefined) {
        // message consumed
        ctx.deleteMessage(ctx.wizard.state.sendData.message_id)
          .catch(error => {
            logger.error(error)
          })
      }
      
      return ctx.scene.leave();
    }
    
    
    
    
  })

// add send wizard scene to a middleware
const stage = new Scenes.Stage([sendWizard]);

// cancel send scene

stage.action(CALLBACK_DATA_SEND_CANCEL, async ctx => {
  var user = UsersDao.getById(ctx.callbackQuery.from.id)
  let cancelledText = await getBaseTextOpenKB(user) + `\n🤖: Transfert cancelled. ❌`
  ctx.telegram.editMessageText(ctx.chat.id, ctx.callbackQuery.message.message_id, undefined, cancelledText
    , Markup.inlineKeyboard(INLINE_KEYBOARD_PLAY))

    
  ctx.scene.leave()
})


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
  .catch(error =>  logger.error(error))

  getBaseTextOpenKB(user).then( (ucoBalanceText ) => {
    let qrTextUpdate = ucoBalanceText + `\n🤖: Click to copy your address : <code>` + address + `</code>`
    qrTextUpdate += `\n🤖: Or use your QRCode below`

    ctx.editMessageText(qrTextUpdate,{reply_markup: ctx.callbackQuery.message.reply_markup, parse_mode: "HTML"})
    .catch(error =>  logger.error(error))
   
   
  })
} ) 

// CALLBACK BACKUP

function formatWords(words) {
  let message = '';
  for (let i = 0; i < words.length; i++) {
    if (i % 4 === 0 && i !== 0) {
      message += '\n';
    }
    message += `${i + 1}. ${words[i]} `;
  }
  return message.trim();
}


bot.action(CALLBACK_DATA_BACKUP, async ctx => {

  

  const user = UsersDao.getById(ctx.callbackQuery.from.id)
  const baseTextReply = await getBaseTextOpenKB(user)
 
  if(user === undefined ){
     
   return ctx.reply(`🤖: Unknown life form : ${ctx.callbackQuery.from.first_name} 🛑`)
   .catch(error => logger.error(error));
 }
 
  const seedUint8Array = seedStringToUint8Array(user.seed)
  const words = uint8ArrayToMnemonic(seedUint8Array)

  const recovery_phrase_text = formatWords(words)

  let textUpdate = baseTextReply + `\n🤖: Here your recovery phrase, the message will be automatically deleted after 5 minutes.`
 
  ctx.editMessageText(textUpdate,{reply_markup: ctx.callbackQuery.message.reply_markup, parse_mode: "HTML"})
  .catch(error =>  logger.error(error))
  
   const sentMessage = await ctx.reply(recovery_phrase_text).catch(error =>  logger.error(error))
   

     // Delete the message after 300 seconds (300000 milliseconds)
  setTimeout(async () => {
    try {
      await ctx.deleteMessage(sentMessage.message_id);
      console.log('Message deleted successfully');
    } catch (err) {
      if (err.response && err.response.error_code === 400) {
        console.log('Message was already deleted by the user.');
      } else {
        console.error('Failed to delete message:', err);
      }
    }
  }, 300000)


   
 
  
    
    
    
  
 } ) 


// tip handler
//const regex = /^!tip (\d+,\d{1,16}|\d+)/;
// using command instead of hears to keep privacy mode ON in groups
// /tip <amount> Use this to send UCO to the user you are replying to
bot.command('tip', async ctx => {
//bot.hears(regex, async ctx => {
 
 //  var rgx = /(\d+,\d{1,16}|\d+)/;
 const rgx = /^\/tip\s+@(\w+)\s+(\d+(?:,\d{1,16})?|\d+)/
 const match = rgx.exec(ctx.message.text);

 if (!match) {
  return ctx.reply(`🤖: Bad command : Usage : /tip @username amount. 🛑`, {
    reply_to_message_id: ctx.message.message_id
  })
  .catch(error => logger.error(error));
}

  const [, username, tipValue] = match;
  var user = UsersDao.getById(ctx.message.from.id)
  
  
  
  logger.info(`tip amount : ${tipValue}`)

  if(user === undefined ){
    
   return ctx.reply(`🤖: Unregistred life form : ${ctx.message.from.first_name} 🛑. Open a private chat with @${ctx.botInfo.username} to start interacting with me.`, {
    reply_to_message_id: ctx.message.message_id
  })
    .catch(error => logger.error(error));
  }

  if (user.wallet === undefined) {
     return ctx.reply(`🤖: You need to generate a wallet first ! 🛑`,{
       reply_to_message_id: ctx.message.message_id
      })
     .catch(error => logger.error(error));
   }

/*   if (ctx.message.reply_to_message?.from?.id === undefined) {
    return ctx.telegram.sendMessage(ctx.message.chat.id, `🤖: Hey ${ctx.message.from.first_name}, you can tip by replying to another user. 🛑`)
    .catch(error => logger.error(error));
  } */

  

  if(isNaN(Number(tipValue))){
   // return ctx.telegram.sendMessage(ctx.message.chat.id, `🤖: Invalid Number. 🛑`)
   return ctx.reply(`🤖: Invalid Number. 🛑`, {
    reply_to_message_id: ctx.message.message_id
  })
    .catch(error => logger.error(error));
  }

  var index = await archethic.transaction.getTransactionIndex(user.wallet)
  var seedUint8Array = seedStringToUint8Array(user.seed)
  var lastAddress = Crypto.deriveAddress(seedUint8Array,index)

  var userBalance = await archethic.network.getBalance(lastAddress)
  
  .catch(error => {
    logger.error(error)
    return 0})


  if (tipValue > userBalance.uco / 10 ** 8){
   // return ctx.telegram.sendMessage(ctx.message.chat.id, `🤖: Hey ${ctx.message.from.first_name}, waiting for payday ? Insufficients funds. 🛑`)
   return ctx.reply(`🤖: Hey ${ctx.message.from.first_name}, waiting for payday ? Insufficients funds. 🛑`,{
    reply_to_message_id: ctx.message.message_id
   })
    .catch(error => logger.error(error));
  }

 // var recipientID = ctx.message.reply_to_message.from.id
 // var recipientUser = UsersDao.getById(recipientID)
 var recipientUser = UsersDao.getByName(username)

  if (recipientUser === undefined) {
    //return ctx.telegram.sendMessage(ctx.message.chat.id, `🤖: ${ctx.message.reply_to_message.from.first_name} is not registered with me ! 🛑`)
    return ctx.reply(`🤖: @${username} is not registered with me ! 🛑`,{
      reply_to_message_id: ctx.message.message_id
     })
    .catch(error => logger.error(error));
  }

  if (recipientUser.wallet === undefined) {
   // return ctx.telegram.sendMessage(ctx.message.chat.id, `🤖: ${ctx.message.reply_to_message.from.first_name} has not generated a wallet ! 🛑`)
    return ctx.reply(`🤖: @${username} has not generated a wallet ! 🛑`,{
      reply_to_message_id: ctx.message.message_id
     })
    .catch(error => logger.error(error));
  }

  if(recipientUser.id === user.id){
   // return ctx.telegram.sendMessage(ctx.message.chat.id, `🤖: You are wasting my time ! ${ctx.message.from.first_name} is tipping himself... 🛑`)
   return ctx.reply(`🤖: You are wasting my time ! ${ctx.message.from.first_name} is tipping himself... 🛑`,{
    reply_to_message_id: ctx.message.message_id
   })
    .catch(error => logger.error(error));
  }

  


  var isConfirmed = false
  var tx = archethic.transaction.new()
  .setType("transfer")
  .addUCOTransfer(recipientUser.wallet, parseFloat(tipValue) * 10 ** 8 )
  .build(seedUint8Array, index)
  .originSign(originPrivateKey)
  .on("confirmation", (nbConf, maxConf) => {
    console.log(nbConf, maxConf)
    if (nbConf == maxConf && !isConfirmed ){
      isConfirmed = true
    //  ctx.telegram.sendMessage(ctx.message.chat.id, `🤖: ${ctx.message.from.first_name} sent ${tipValue[0]} to ${ctx.message.reply_to_message.from.first_name} ! 💸`)

    return ctx.reply(`🤖: ${ctx.message.from.first_name} sent ${tipValue} UCO to @${username} ! 💸`,{
      reply_to_message_id: ctx.message.message_id
     })
    }

  })
  console.log(tx.toJSON())

  try {

   
    tx.send()

    


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
*/


bot.launch()

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
