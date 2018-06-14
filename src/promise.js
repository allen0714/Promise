const PENDING = 'pending';
const FULFILLED = 'fulfilled';
const REJECTED = 'rejected';

function Promise (resolver) {
  if (!isFunction(resolver)) {
    throw new TypeError('resolver must be a function.');
  }
  this.state = PENDING;
  this.value = undefined;
  this.queue = [];
  if (resolver !== Internal) { //区分内部调用还是外部调用
    safelyResolveThen(this, resolver)
  }
}

/**
 * 安全地执行then函数
 * @param self
 * @param then
 * try catch 捕获函数内抛出的异常，
 * resolve reject只执行一次，多次调用没有作用
 * 没有错误执行doResolve 有错误执行doReject
 */
function safelyResolveThen (self, then) {

}

function doResolve (self, value) {
  try {
    const then = getThen(value);
    if (then) {
      safelyResolveThen(self, then);
    } else {
      self.state = FULFILLED;
      self.value = value;
      self.queue.forEach(function (queueItem){
        queueItem.callFulfilled(value);
      });
    }
    return self;
  } catch(err) {
    return doReject(self, err);
  }
}

function doReject (self, err) {
  self.state = REJECTED;
  self.value = err;
  self.queue.forEach(function(queueItem){
    queueItem.callReject(err);
  });
  return self;
}

function getThen (promise) {
  const then = promise && promise.then;
  // A+规范： 如果 then 是函数，将 x（即被调用的 promise） 作为函数的 this 调用。
  if (promise && (isObject(promise) || isFunction(promise)) && isFunction(then)) {
    return function applyThen () {
      then.apply(promise, arguments);
    }
  }
}

Promise.prototype.then = function (onFulfilled, onRejected) {
  if((!isFunction(onFulfilled) && (this.state === FULFILLED)) || (!isFunction(onRejected) && (this.state === REJECTED))) {
    // 值穿透即传入 then/catch 的参数如果不为函数，则忽略该值，返回上一个 promise 的结果
    return this;
  }
  const promise = new this.constructor(Internal);
  if (this.state === PENDING) {
    this.queue.push(new QueueItem(promise, onFulfilled, onRejected));
  } else {
    // promise状态改变了
    const resolver = (this.state === FULFILLED) ? onFulfilled : onRejected;
    unwrap(promise, resolver, this.value);
  }
  return promise;
};

/**
 * 解包（即拿到父 promise 的结果设置当前 promise 的状态和值）
 * @param promise
 * @param func 父promise的then回调onFulfilled/onReject
 * @param value 父值，value或error
 */
function unwrap (promise, func, value) {
  process.nextTick(function() {
    let returnValue;
    try {
      returnValue = func(value);
    } catch(error) {
      return doReject(promise, error);
    }
    if (promise === returnValue) {
      //返回值不能够是promise本身，否则会造成死循环
      doReject(promise, new TypeError('Cannot resolve promise with itself'));
    } else {
      doResolve(promise, returnValue);
    }

  });
}

function QueueItem(promise, onFulfilled, onRejected) {
  this.promise = promise;
  this.callFulfilled = function(value) {
    if (isFunction(onFulfilled)) {
      unwrap(this.promise, onFulfilled, value);
    } else {
      doResolve(this.promise, value);
    }
  }
}

function resolve (value) {
  if (value instanceof this) {
    return value;
  }
  return doResolve(new this(Internal),value);
}

function reject(reason) {
  return doReject(new this(Internal), reason);
}

Promise.prototype.catch = function (onRejected) {
  return this.then(null, onRejected);
};

Promise.resolve = resolve;
Promise.reject = reject;
Promise.all = function () {}
Promise.race = function () {}

function Internal() {}

function isFunction (func){
  return typeof func === 'function';
}

function isObject(obj) {
  return typeof obj === 'object';
}

function isArray(arr) {
  return Array.isArray(arr);
}


module.exports = Promise;
