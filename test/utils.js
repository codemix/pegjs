"use strict";

const chai = require("chai");

class Call {
  constructor(args) {
    this.args = args;
  }

  calledWithExactly(...args) {
    return chai.util.eql(this.args, args);
  }
}

function dummy() {
  const stub = (...args) => {
    stub.callCount++;
    stub.called = true;
    stub.calls.push(new Call(args));
  };
  stub.called = false;
  stub.callCount = 0;
  stub.calls = [];
  stub.getCall = n => stub.calls[n];
  return stub;
}

// Just enough of Sinon's spy() routine.
exports.spy = function spy() {
  return dummy();
};

// Just enough of Sinon's stub() routine.
exports.stub = function stub(obj, methodName) {
  const f = obj[methodName];
  const stub = dummy();
  obj[methodName] = stub;
  stub.restore = () => { obj[methodName] = f; };

  return f;
};
