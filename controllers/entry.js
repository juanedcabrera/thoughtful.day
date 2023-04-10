const express = require("express");
const router = express.Router();
const db = require("../models");
const cryptoJs = require("crypto-js");
const methodOverride = require('method-override');

// GET /entries/new -- SHOW form to create a new entry
router.get("/new", async (req, res) => {
  let quotes = [];
  const apiUrl = "https://api.themotivate365.com/stoic-quote";
  try {
    await fetch(apiUrl)
      .then((res) => res.json())
      .then((data) => {
        quotes = data;
      });
  } catch (err) {
    console.log(err);
  }

  const user = res.locals.user;
  res.render("entries/new.ejs", {
    user,
    quotes,
  });
});

// router.get('/unauthorized') method
router.get("/unauthorized", function (req, res, next) {
  res.render("unauthorized", {
    user: req.user,
    partials: { header: "./partials/header" },
  });
});

// POST /entries -- CREATE route to add a new entry
router.post("/", async (req, res) => {
  try {
    const title = req.body.title;
    const content = req.body.content;
    let tags = req.body.tags; // had to change to let for tags to work

    const decryptedPk = cryptoJs.AES.decrypt(
      req.cookies.userId,
      process.env.ENC_KEY
    );
    const decryptedPkString = decryptedPk.toString(cryptoJs.enc.Utf8);
    const user = await db.user.findByPk(decryptedPkString);

    const newEntry = await db.entry.create({
      title: title,
      content: content,
      userId: user.id,
    });

    // tag logic
    let foundTags = [];
    // convert to an array with a single element
    if (!Array.isArray(tags)) {
      tags = [tags];
    }
    for (let tag of tags) {
      let foundTag = await db.tag.findOne({
        where: {
          name: tag,
        },
      });
      foundTags.push(foundTag);
    }

    newEntry.addTags(foundTags);

    res.redirect("/entries");
  } catch (err) {
    console.log(err);
    res.redirect("/");
  } finally {
    console.log("hello");
  }
});

// GET /entries -- INDEX route to show all the entries
router.get("/", async (req, res) => {
  console.log(`user is ${res.locals.user.email} `);
  try {
    const entries = await db.entry.findAll({
      where: {
        userId: res.locals.user.id,
      },
    });
    res.render("entries/index.ejs", { entries });
  } catch (err) {
    console.log(err);
    res.redirect("/");
  }
});

// GET /entries/:id -- SHOW route to display a single entry
router.get("/:id", async (req, res) => {
  try {
    const foundEntry = await db.entry.findAll({
      where: {
        // filter entry by current user logged in
        userId: res.locals.user.id,
        id: req.params.id,
      },
    });
    if (!foundEntry.length) {
      // Entry not found redirect to index
      return res.redirect("/entries?message=Entry not found");
    } else {
      // render show page for entry
      res.render("entries/show.ejs", {
        entry: foundEntry[0],
      });
    }
  } catch (err) {
    console.log(err);
    res.redirect("/entries?message=An error occured");
  }
});

// GET /entries/:id/edit -- SHOW form to edit an entry
router.get("/:id/edit", async (req, res) => {
  try {
    // Find the entry with the given ID
    const foundEntry = await db.entry.findAll({
      where: {
        // filter entry by current user logged in
        userId: res.locals.user.id,
        id: req.params.id,
      },
    });

    // Render the edit form with the entry data
    res.render("entries/edit-entry", { entry: foundEntry[0] });
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

// PUT /entries/:id -- UPDATE route to modify an entry
router.put("/:id", async (req, res) => {
  try {
    // Find the entry with the given ID
    const foundEntry = await db.entry.findOne({
      where: {
        // filter entry by current user logged in
        userId: res.locals.user.id,
        id: req.params.id,
      },
    });
    
    // Update the entry with the new data
    await foundEntry.update({
      title: req.body.title,
      content: req.body.content
    });

    // Redirect the user to the updated entry's detail page
    res.redirect(`/entries/${foundEntry.id}`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});




// export the router instance
module.exports = router;
