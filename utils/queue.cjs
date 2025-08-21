let queue = {};

function addToQueue(user, callback) {
  if (queue[user]) {
    return;
  }
  queue[user] = setTimeout(async () => {
    await callback();
    delete queue[user];
  }, 500);
}

function cleanQueue(user) {
  if (queue[user]) {
    clearTimeout(queue[user]);
    delete queue[user];
  }
}

module.exports = { addToQueue, cleanQueue };
