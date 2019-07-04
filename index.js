require('dotenv').config();
var Twitter = require('twitter');
var options = {
  consumer_key: process.env.consumer_key,
  consumer_secret: process.env.consumer_secret,
  access_token_key: process.env.access_token_key,
  access_token_secret: process.env.access_token_secret
};
var axios = require('axios');

var client = new Twitter(options);
var stream = client.stream(
  'statuses/filter',
  {
    track: '@quotedreplies please'
  }
);

stream.on('data', function(tweet) {
  if (isValidMention(tweet)) {
    var status = prepareStatus(tweet);
    sendToApi(`https://twitter.com/${tweet.in_reply_to_screen_name}/status/${tweet.in_reply_to_status_id_str}`);
    sendStatus(status, tweet.id_str);
  } else {
    console.log('this is a retweet, not a mention; or it is a mention to ignore.');
    console.log(tweet.text);
  }
});

stream.on('error', function(error) {
  throw error;
});

function sendStatus(status, id) {
  client.post('statuses/update',
    {
      status: status,
      in_reply_to_status_id: id
    }, function (err, data) {
      if (err) {
        throw error;
      }
  });
}

function sendToApi(tweetIdStr) {
  var data = {
    tweet_id_str: tweetIdStr
  };

  axios.post(`${process.env.api_url}/tweet`, data)
  .then((res) => {
    console.log(`statusCode: ${res.status}`)
    console.log(res.config);
  })
  .catch((error) => {
    console.error(error)
  })
}

function prepareStatus(tweet) {
  var startWords = ['Psst', 'Aye', 'Holla', 'Hey'];
  var tweetTexts = ['Follow this link to view the quoted replies you asked for!', 'Because you asked nicely...', 'Here you go!'];
  var startWordsIndex = Math.floor(Math.random() * startWords.length);
  var tweetTextsIndex = Math.floor(Math.random() * tweetTexts.length);
  var startWord = startWords[startWordsIndex];
  var tweetText = tweetTexts[tweetTextsIndex];
  var staticUrlPart = 'https://twitter.com/search?f=tweets&vertical=default&q=https://twitter.com';
  var usernameString = `@${tweet.user.screen_name} ${startWord}! ${tweetText}`;
  var dynamicUrlPart = `${tweet.in_reply_to_screen_name}/status/${tweet.in_reply_to_status_id_str}`;

  var searchLink = `${staticUrlPart}/${dynamicUrlPart}`;
  var status = `${usernameString}\n${searchLink}\n✨😊`;

  return status;
}

function isValidMention(tweet) {
  if (tweet && tweet.text) {
    var text = tweet.text;
    text = text.replace(/@\w+/g, '').trim();

    if (tweet.in_reply_to_status_id_str
      && tweet.in_reply_to_screen_name
      && text.length < 10) {
      return true;
    }
  }

  return false;
}
