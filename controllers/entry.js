const express = require("express");
const router = express.Router();
const db = require("../models");
const cryptoJs = require("crypto-js");
const methodOverride = require("method-override");
const { Op, Sequelize } = require("sequelize");
const path = require("path");
const fs = require("fs");
const ejs = require("ejs");
const { userInfo } = require("os");

const VALID_TEMPLATES = ['freeform', 'gratitude', 'accomplishment'];

// GET /entries -- INDEX route to show all the entries
router.get("/", async (req, res) => {
  try {
    const { word, tag, date, type } = req.query;
    const searchOptions = {
      where: {
        userId: res.locals.user.id,
      },
      order: [["id", "DESC"]],
    };
    if (tag) {
      searchOptions.include = [
        {
          model: db.tag,
          where: {
            name: tag,
          },
        },
      ];
    }
    if (date) {
      const startDate = new Date(`${date}T00:00:00.000Z`);
      const endDate = new Date(`${date}T23:59:59.999Z`);
      searchOptions.where.createdAt = {
        [Op.between]: [startDate, endDate],
      };
    }

    if (word) {
      searchOptions.where.content = {
        [Op.and]: [
          Sequelize.where(
            Sequelize.cast(Sequelize.col("content"), "text"),
            "ILIKE",
            `%${word}%`
          ),
        ],
      };
    }

    if (type) {
      searchOptions.where.type = {
        [Op.and]: [
          Sequelize.where(
            Sequelize.cast(Sequelize.col("type"), "text"),
            "ILIKE",
            `%${type}%`
          ),
        ],
      };
    }
    

    const entries = await db.entry.findAll(searchOptions);
    res.render("entries/index.ejs", { entries });
  } catch (err) {
    console.log(err);
  }
});

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

  const adjectives = await db.tag.findAll();

  const user = res.locals.user;
  console.log(`This is ${req.query.userSelectedTemplates}`);

  // Check if the form was submitted
  if (req.query.userSelectedTemplates) {
    let selectedTemplate = req.query.userSelectedTemplates;

    if (!VALID_TEMPLATES.includes(selectedTemplate)) {
      return res.redirect('/entries/new');
    }

    // Render template partial
    console.log(`Selected Template: ${selectedTemplate}`);
    res.render("entries/new.ejs", {
      user,
      selectedTemplate,
      quotes,
      adjectives,
    });
  } else {
    // Render the form to select a template
    res.render("entries/new.ejs", {
      user,
      selectedTemplate: false,
    });
  }
});

// PUT /entries/new -- SHOW form to create a new entry
router.put("/new", async (req, res) => {
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

  const adjectives = await db.tag.findAll();

  const user = res.locals.user;

  res.render("entries/new.ejs", {
    user,
    quotes,
    adjectives: adjectives,
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
    const content = {
      content1: req.body.content1,
      content2: req.body.content2,
      content3: req.body.content3,
      content4: req.body.content4,
      content5: req.body.content5,
      content6: req.body.content6,
    };
    let tags = req.body.tags; // had to change to let for tags to work
    const selectedTemplate = req.body.selectedTemplate

    if (!VALID_TEMPLATES.includes(selectedTemplate)) {
      return res.redirect('/entries/new');
    }

    const decryptedPk = cryptoJs.AES.decrypt(
      req.cookies.userId,
      process.env.ENC_KEY
    );
    const decryptedPkString = decryptedPk.toString(cryptoJs.enc.Utf8);
    const user = await db.user.findByPk(decryptedPkString);

    // Get the current date and time in UTC
    const nowUTC = new Date();

    // Get the time zone offset from the user object
    const timeZoneOffsetInHours = user.timezone;

    // Calculate the new hour based on the time zone offset
    const newHour = nowUTC.getUTCHours() + timeZoneOffsetInHours;

    // Set the new hour in the Date object
    nowUTC.setUTCHours(newHour);

    // Format the date and time in the ISO 8601 format
    const formattedDateTime = nowUTC.toISOString();


    console.log(req.body)
    console.log(nowUTC);
    console.log(timeZoneOffsetInHours);
    console.log(newHour);
    console.log(formattedDateTime);
    console.log(selectedTemplate)

    

    const newEntry = await db.entry.create({
      userId: user.id,
      content: content,
      createdAt: formattedDateTime,
      type: selectedTemplate,
    });

    // tag logic
    if (Array.isArray(tags) && tags.length > 0) {
      const tagLookups = tags.map((tagName) =>
        db.tag.findOne({ where: { name: tagName } })
      );
      const foundTags = await Promise.all(tagLookups);
      // console.log("foundTags:", foundTags);
      const validTags = foundTags.filter((tag) => tag !== null);
      // console.log("validTags:", validTags);
      if (validTags.length > 0) {
        await newEntry.addTags(validTags);
      }
    }

    res.redirect("/entries");
  } catch (err) {
    console.log(err);
    res.render("unauthorized.ejs");
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
      include: [
        {
          model: db.tag,
          as: "tags",
          attributes: ["name"],
          through: {
            attributes: [],
          },
        },
      ],
    });
    let selectedTemplate = foundEntry[0].type
    if (!VALID_TEMPLATES.includes(selectedTemplate)) {
      selectedTemplate = 'freeform';
    }
    if (!foundEntry.length) {
      // Entry not found redirect to index
      return res.redirect("/entries?message=Entry not found");
    } else {
      // render show page for entry
      res.render("entries/show.ejs", {
        entry: foundEntry[0],
        selectedTemplate
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

    const adjectives = await db.entry_tag.findAll({
      where: {
        entryId: req.params.id,
      },
    });
    let selectedTemplate = foundEntry[0].type
    if (!VALID_TEMPLATES.includes(selectedTemplate)) {
      selectedTemplate = 'freeform';
    }
    // Render the edit form with the entry data
    // console.log(adjectives);
    res.render("entries/edit-entry", { 
      entry: foundEntry[0], 
      adjectives,
      selectedTemplate 
    });
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

    // Entry not found - redirect to index
    if (!foundEntry) {
      res.redirect("/entries?message=Entry not found");
    }

    // Grouping all Content together for JSONB
    const { content1, content2, content3, content4, content5, content6 } = req.body;
    const updatedContent = {
      content1,
      content2,
      content3,
      content4,
      content5,
      content6,
    };

    // Update the entry with the new data
    await db.entry.update(
      { content: updatedContent },
      { where: { id: foundEntry.id } }
    );

    // Redirect the user to the updated entry's detail page
    res.redirect("/entries");
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

// DELETE /entries/:id -- DELETE route to delete an entry
router.delete("/:id", async (req, res) => {
  try {
    // Find the entry with the given ID
    const foundEntry = await db.entry.findOne({
      where: {
        // filter entry by current user logged in
        userId: res.locals.user.id,
        id: req.params.id,
      },
    });

    // Delete the entry
    await foundEntry.destroy();

    // Redirect the user to the entries list
    res.redirect("/entries");
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

// GET /entries/search

router.get("/search", async (req, res) => {
  try {
    res.send("hello search");
  } catch (err) {
    console.log(err);
  }

  const user = res.locals.user;
  res.render("entries/search.ejs");
});
// export the router instance
module.exports = router;
