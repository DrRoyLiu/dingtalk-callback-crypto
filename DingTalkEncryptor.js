/* eslint-disable no-bitwise */
'use strict';

const Crypto = require('crypto');
const DingTalkEncryptException = require('./DingTalkEncryptException');

class DingTalkEncryptor {
  constructor(token, encodingAesKey, corpIdOrSuiteKey) {
    this.AES_ENCODE_KEY_LENGTH = 43;
    this.RANDOM_LENGTH = 16;

    this.token = token;
    this.encodingAesKey = encodingAesKey;
    this.aesKey = Buffer.from(encodingAesKey + "=", 'base64');
    this.corpId = corpIdOrSuiteKey;
    this.iv = this.aesKey.slice(0, 16);
  }

  // verify encodingAesKey
  set encodingAesKey(val) {
    if (!val || val.length !== this.AES_ENCODE_KEY_LENGTH) {
      throw new DingTalkEncryptException(900004);
    }
  }

  encrypt(random, plainText) {
    try {
      let randomBuf = Buffer.from(random);
      let plainTextBuf = Buffer.from(plainText);
      let textLen = plainTextBuf.length;
      let textLenBuf = Buffer.from([(textLen >> 24 & 255), (textLen >> 16 & 255), (textLen >> 8 & 255), (textLen & 255)]);
      let corpIdBuf = Buffer.from(this.corpId);
      let padCount = 32 - (randomBuf.length + textLenBuf.length + plainTextBuf.length + corpIdBuf.length) % 32;
      let padBuf = Buffer.from(new Array(padCount).fill(padCount));
      let finalBuf = Buffer.concat([randomBuf, textLenBuf, plainTextBuf, corpIdBuf, padBuf]);
      let crypto = Crypto.createCipheriv('AES-256-CBC', this.aesKey, this.iv);
      return Buffer.concat([crypto.update(finalBuf)]).toString('base64');
    } catch (e) {
      throw new DingTalkEncryptException(900007);
    }
  }

  decrypt(encrypted) {
    let decrypt;
    try {
      // decrypt
      let crypto = Crypto.createDecipheriv('AES-256-CBC', this.aesKey, this.iv);
      decrypt = Buffer.concat([crypto.update(encrypted, 'base64')]);
    } catch (e) {
      throw new DingTalkEncryptException(900008);
    }

    let corpId,
      plainText;
    try {
      let textLen = decrypt.slice(16, 20).readUInt32BE();
      plainText = decrypt.slice(20, 20 + textLen).toString();
      let pad = decrypt.length - 16 - 4 - textLen - 20;
      if (pad > 31) pad = 0;
      let finalDecrypt = decrypt.slice(0, decrypt.length - pad);
      corpId = finalDecrypt.slice(20 + textLen).toString();
    } catch (e) {
      throw new DingTalkEncryptException(900009);
    }
    if (!this.corpId == corpId && !corpId.startsWith(this.corpId) && !this.corpId.startsWith(corpId)) {
      throw new DingTalkEncryptException(900010);
    } else {
      return plainText;
    }
  }
  getSignature(token, timestamp, nonce, encrypt) {
    timestamp = timestamp + '';
    let strArr = [token, timestamp, nonce, encrypt];
    strArr.sort();
    let sha1 = Crypto.createHash('sha1');
    sha1.update(strArr.join(''))
    return sha1.digest('hex');
  }

  getEncryptedMap(plaintext, timeStamp, nonce) {
    timeStamp = timeStamp + '';
    if (plaintext == null) {
      throw new DingTalkEncryptException(900001);
    } else if (timeStamp == null) {
      throw new DingTalkEncryptException(900002);
    } else if (nonce == null) {
      throw new DingTalkEncryptException(900003);
    } else {
      let encrypt = this.encrypt(this.getRandomStr(this.RANDOM_LENGTH), plaintext);
      let signature = this.getSignature(this.token, timeStamp, nonce, encrypt);
      return {
        msg_signature: signature,
        encrypt: encrypt,
        timeStamp: timeStamp,
        nonce: nonce
      };
    }
  }

  getDecryptMsg(msgSignature, timeStamp, nonce, encryptMsg) {
    let signature = this.getSignature(this.token, timeStamp, nonce, encryptMsg);
    if (signature !== msgSignature) {
      throw new DingTalkEncryptException(900006);
    } else {
      return this.decrypt(encryptMsg);
    }
  }

  getRandomStr(size) {
    let base = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let randomStr = '';
    for (let i = size; i > 0; --i) {
      randomStr += base[Math.floor(Math.random() * base.length)];
    }
    return randomStr;
  };
}

module.exports = DingTalkEncryptor;