const postsCollection = require("../db").db().collection("posts");
const ObjectId = require("mongodb").ObjectId;
const User = require("./User");

const Post = function (data, userid) {
  this.data = data;
  this.userid = userid;
  this.errors = [];
};

Post.prototype.cleanUp = function () {
  if (typeof this.data.title != "string") {
    this.data.title = "";
  }

  if (typeof this.data.body != "string") {
    this.data.body = "";
  }

  // get rid of any bogus properties and add creation date
  this.data = {
    title: this.data.title.trim(),
    body: this.data.body.trim(),
    createdDate: new Date(),
    author: ObjectId(this.userid),
  };
};

Post.prototype.validate = function () {
  if (!this.data.title.length) {
    this.errors.push("You must provide a title.");
  }

  if (!this.data.body.length) {
    this.errors.push("You must provide post content.");
  }
};

Post.prototype.create = function () {
  return new Promise((resolve, reject) => {
    this.cleanUp();
    this.validate();
    if (!this.errors.length) {
      // save post into database
      postsCollection
        .insertOne(this.data)
        .then(() => {
          resolve();
        })
        .catch(() => {
          this.errors.push("Please try again later.");
          reject(this.errors);
        });
    } else {
      reject(this.errors);
    }
  });
};

Post.reusablePostQuery = function (uniqueOperations, vistorId) {
  return new Promise(async function (resolve, reject) {
    const aggOperations = uniqueOperations.concat([
      {
        $lookup: {
          from: "users",
          localField: "author",
          foreignField: "_id",
          as: "authorDocument",
        },
      },
      {
        $project: {
          title: 1,
          body: 1,
          createdDate: 1,
          author: { $arrayElemAt: ["$authorDocument", 0] },
        },
      },
    ]);

    // Mongodb Aggregation. toArray returns a promise
    let posts = await postsCollection.aggregate(aggOperations).toArray();

    // clean up author property in each post object
    posts = posts.map(function (post) {
      post.isVistorOwner = post.author._id.equals(vistorId);

      post.author = {
        username: post.author.username,
        avatar: new User(post.author, true).avatar,
      };
      return post;
    });

    resolve(posts);
  });
};

Post.findSingleById = function (id, vistorId) {
  return new Promise(async function (resolve, reject) {
    if (typeof id != "string" || !ObjectId.isValid(id)) {
      reject();
      return;
    }

    let posts = await Post.reusablePostQuery(
      [{ $match: { _id: new ObjectId(id) } }],
      vistorId
    );

    if (posts.length) {
      resolve(posts[0]);
    } else {
      reject();
    }
  });
};

Post.findByAuthorId = function (authorId) {
  return Post.reusablePostQuery([
    { $match: { author: authorId } },
    { $sort: { createdDate: -1 } },
  ]);
};

module.exports = Post;