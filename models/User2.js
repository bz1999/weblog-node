// load user model (collection) from mongodb
const usersColletion = require("../db").db().collection("users");

const validator = require("validator");

const bcrypt = require("bcryptjs");

const md5 = require("md5");

class User {
  constructor(data) {
    this.data = data;
    this.errors = [];
  }

  cleanUp() {
    if (typeof this.data.username != "string") {
      this.data.username = "";
    }

    if (typeof this.data.email != "string") {
      this.data.email = "";
    }

    if (typeof this.data.password != "string") {
      this.data.password = "";
    }

    // get rid of any bogus properties
    this.data = {
      username: this.data.username.trim().toLowerCase(),
      email: this.data.email.trim().toLowerCase(),
      password: this.data.password,
    };
  }

  validate() {
    return new Promise(async (resolve, rejecct) => {
      // Validate username
      if (this.data.username.length == 0) {
        this.errors.push("You must provide a username.");
      } else {
        if (!validator.isAlphanumeric(this.data.username)) {
          this.errors.push("Username can only contain letters and numbers.");
        }

        if (this.data.username.length < 3) {
          this.errors.push("Username must be at least 3 characters.");
        } else if (this.data.username.length > 30) {
          this.errors.push("Username cannot exeed 30 charaters.");
        }
      }

      // Validate email
      if (!validator.isEmail(this.data.email)) {
        this.errors.push("You must provide a valid email address.");
      }

      // Validate password
      if (this.data.password.length == 0) {
        this.errors.push("You must provide a password.");
      } else if (this.data.password.length < 8) {
        this.errors.push("Password must be at least 8 characters.");
      } else if (this.data.password.length > 50) {
        this.errors.push("Password cannot exeed 50 charaters.");
      }

      // Check userame and email existence if no previous errors found
      if (!this.errors.length) {
        // mongodb collection findOne returns a promise
        const usernameExists = await usersColletion.findOne({
          username: this.data.username,
        });
        const emailExists = await usersColletion.findOne({ email: this.data.email });

        if (usernameExists) {
          this.errors.push("That username is already taken.");
        }
        if (emailExists) {
          this.errors.push("That email is already being used.");
        }
      }

      resolve();
    });
  }

  register() {
    return new Promise(async (resolve, reject) => {
      // Step #1: Validate user data
      this.cleanUp();
      await this.validate();

      // Step #2: Only if there are no validation errors
      // then save the user data into a database
      if (!this.errors.length) {
        // hash user password, salt example: $2a$10$MkGi13Zp/stXhVnQbSfMwu
        this.data.password = bcrypt.hashSync(this.data.password, 10);
        await usersColletion.insertOne(this.data);
        this.getAvatar();
        resolve();
      } else {
        reject(this.errors);
      }
    });
  }

  login() {
    return new Promise((resolve, reject) => {
      this.cleanUp();
      usersColletion
        .findOne({ username: this.data.username })
        .then((attemptedUser) => {
          if (
            attemptedUser &&
            bcrypt.compareSync(this.data.password, attemptedUser.password)
          ) {
            // delete password in the memory and get email
            delete this.data.password;
            this.data.email = attemptedUser.email;

            this.getAvatar();
            resolve("Congrats.");
          } else {
            reject("Invalid username / password.");
          }
        })
        .catch((err) => reject("Please try again later."));
    });
  }

  getAvatar() {
    this.avatar = `https://gravatar.com/avatar/${md5(this.data.email)}?s=128`;
  }
}

module.exports = User;
