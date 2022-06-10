const archethic = require('archethic')
const { Telegraf, Markup } = require('telegraf');
const { BIP39 } = require('bip39');
const { randomSecretKey } = require('archethic');
const {  randomBytes } = require('crypto');
const bot = new Telegraf(process.env.BOT_TOKEN)
if (bot === undefined) {
  throw new Error('BOT_TOKEN must be provided!')
}
const wallet_button_text = "Wallet";
const Generate_wallet_button_text = "Generate Wallet";
const curveType = "ed25519";

var chatData = {

}

var chatMap = new Map();

function generateSeed(){

  const randomString = randomBytes(32);

  return randomString;
}

function generateAddress(seed, index) {
 
  var address = archethic.deriveAddress(seed,index)
  return address;
}

function generatePemText(seed,publicAddress){
  const { privateKey }  = archethic.deriveKeyPair(seed,0);
  var pemText = "-----BEGIN PRIVATE KEY for " + publicAddress + "-----" + "\n";
  pemText+= Buffer.from(privateKey).toString('base64').replace(/.{64}/g, '$&\n') + "\n";
  pemText+= "-----END PRIVATE KEY for "+ publicAddress + "-----";

  return Buffer.from(pemText);
  
  
  
}

bot.command('quit', (ctx) => {
  // Explicit usage
  ctx.telegram.leaveChat(ctx.message.chat.id)

  // Using context shortcut
  // ctx.leaveChat()
})

bot.command('start', ctx => {
  ctx.telegram.sendMessage(ctx.message.chat.id, "Home", reply_markup = Markup.keyboard([["Wallet"],["Help","About"]])
  /*{
    reply_markup: {
      keyboard: [
        [
          { text: "WALLET" }
        ]
      ]
    }
  }
  */)
})

bot.hears("Wallet", ctx =>{

  if(!chatMap.has(ctx.message.chat.id)){
    ctx.telegram.sendMessage(ctx.message.chat.id, "Wallet",
    reply_markup = Markup.keyboard([[Generate_wallet_button_text],["Back"]]))
 
  }
  
   else{
    ctx.telegram.sendMessage(ctx.message.chat.id, "Wallet generated.",
    reply_markup = Markup.keyboard([["Wallet : " + chatMap.get(ctx.message.chat.id).publicAddress.toString()],["Back"]]))
   }
})

bot.hears(Generate_wallet_button_text, ctx =>{

  var chatId = ctx.message.chat.id;
  var seed = generateSeed();
  var index = 0;

  var publicAddress = generateAddress(seed,index);
  
  var chatAddressData = {
    seed : seed,
    publicAddress : publicAddress
  }
  var pemTextBuffer = generatePemText(seed,publicAddress);
  chatMap.set(ctx.message.chat.id, chatAddressData);

  
  ctx.replyWithDocument({source: pemTextBuffer , filename: publicAddress + ".pem" })
  

  ctx.telegram.sendMessage(ctx.message.chat.id, "Wallet generated : ")
  ctx.telegram.sendMessage(ctx.message.chat.id, chatMap.get(chatId).publicAddress,
   reply_markup = Markup.keyboard([["Wallet : " + chatMap.get(chatId).publicAddress.toString()],["Back"]]))

})

bot.hears("Back", ctx => {
  ctx.telegram.sendMessage(ctx.message.chat.id, "Home", reply_markup = Markup.keyboard([["Wallet"],["Help","About"]]))
  
})

bot.hears("Help", ctx => {
  ctx.telegram.sendMessage(ctx.message.chat.id, "I'm here to help you set your archethic wallet.")
  
})

bot.hears("About", ctx => {
  ctx.telegram.sendMessage(ctx.message.chat.id, "Telegram bot done with Telegraf and Archethic javascript libraries.")
  
})
const regex = /^!tip \d+,*\d{0,16}/;
bot.hears(regex, ctx => {
  var rgx = /\d+,*\d{0,16}/;
  var tipValue = rgx.exec(ctx.message.text);
  ctx.telegram.sendMessage(ctx.message.chat.id, `You tipped ${tipValue[0]}!`);
  
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
