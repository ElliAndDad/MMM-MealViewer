const NodeHelper = require("node_helper");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

module.exports = NodeHelper.create({
    start: function () {
        this.fetchingData = {};
        console.log("Starting node helper for: " + this.name);
    },

    socketNotificationReceived: function (notification, payload) {
        if (notification === "GET_MEAL_DATA") {
            this.getMealData(payload);
        }
    },

    getMealData: async function (payload) {
        const { identifier, schoolId, filters, itemTypeFilters, exactNameFilters, startsWithFilters, startDay, endDay, showPastDays, hideTodayAfter, showBreakfast, showLunch } = payload;

        if (this.fetchingData[identifier]) {
            return;
        }

        this.fetchingData[identifier] = true;
        const dateRange = this.getDateRange(startDay, endDay);
        const url = `https://api.mealviewer.com/api/v4/school/${schoolId}/${dateRange.start}/${dateRange.end}/`;

        console.log(`Requesting data from URL: ${url}`);
        console.log(`Date range: ${dateRange.start} to ${dateRange.end}`);

        try {
            const response = await axios.get(url);
            console.log("API Response status:", response.status);

            // this.writeDataToFile(response.data, "rawMealData.json");
            const mealData = this.parseMealData(response.data, filters, itemTypeFilters, exactNameFilters, startsWithFilters, showPastDays, hideTodayAfter, showBreakfast, showLunch);
            // this.writeDataToFile(mealData, "parsedMealData.json");
            const schoolLogo = `https://custcdn.mealviewer.com/schoollogo/${response.data.physicalLocation?.schoolSettings?.schoolLogo}`;
            const schoolName = response.data.physicalLocation?.name || "School";
            this.sendSocketNotification("MEAL_DATA", {
                identifier: identifier,
                mealData: mealData,
                schoolLogo: schoolLogo,
                schoolName: schoolName,
                hasMenus: mealData.length > 0
            });
        } catch (error) {
            console.error("Error fetching meal data:", error.message);
            if (error.response) {
                console.error("Error response data:", error.response.data);
                console.error("Error response status:", error.response.status);
                console.error("Error response headers:", error.response.headers);
            }
            // Send a notification even if there's an error
            this.sendSocketNotification("MEAL_DATA", {
                identifier: identifier,
                mealData: [],
                schoolLogo: null,
                schoolName: "Error fetching data",
                hasMenus: false
            });
        } finally {
            this.fetchingData[identifier] = false;
        }
    },

    getDateRange: function (startDay, endDay) {
        const today = new Date();
        const currentDay = today.getDay();

        // Calculate the date of this week's start day
        const startDate = new Date(today);
        startDate.setDate(today.getDate() - currentDay + startDay);

        // If start day is after today, go back one week
        if (startDate > today) {
            startDate.setDate(startDate.getDate() - 7);
        }

        // Calculate the end date
        const endDate = new Date(startDate);
        const daysInRange = (endDay - startDay + 7) % 7 + 1;
        endDate.setDate(startDate.getDate() + daysInRange - 1);

        const formatDate = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${month}-${day}-${year}`;
        };

        return {
            start: formatDate(startDate),
            end: formatDate(endDate)
        };
    },

    parseMealData: function (jsonData, filters, itemTypeFilters, exactNameFilters, startsWithFilters, showPastDays, hideTodayAfter, showBreakfast, showLunch) {
        const mealData = [];
        const menuSchedules = jsonData.menuSchedules;
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Set to beginning of the day for accurate comparison
        let hideHour, hideMinute;

        if (hideTodayAfter.toLowerCase() !== "never") {
            [hideHour, hideMinute] = hideTodayAfter.split(':').map(Number);
        }

        menuSchedules.forEach(schedule => {
            const date = new Date(schedule.dateInformation.dateFull);
            date.setHours(0, 0, 0, 0); // Set to beginning of the day for accurate comparison
            const formattedDate = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

            console.log(`Processing date: ${formattedDate}, Today: ${today.toDateString()}`);
            console.log(`showBreakfast: ${showBreakfast}, showLunch: ${showLunch}`);

            // Include the day if it's today or in the future
            if (date >= today || showPastDays) {
                let includeDay = true;

                // Check if we should hide today's menu after a certain time
                if (date.getTime() === today.getTime() && hideTodayAfter.toLowerCase() !== "never") {
                    const now = new Date();
                    if (now.getHours() > hideHour || (now.getHours() === hideHour && now.getMinutes() >= hideMinute)) {
                        includeDay = false;
                    }
                }

                if (includeDay) {
                    let breakfast = showBreakfast ? [] : null;
                    let lunch = showLunch ? [] : null;

                    schedule.menuBlocks.forEach(block => {
                        console.log(`Processing menu block: ${block.blockName}`);
                        if (block.cafeteriaLineList && block.cafeteriaLineList.data && block.cafeteriaLineList.data[0]) {
                            const items = block.cafeteriaLineList.data[0].foodItemList.data;
                            const mealType = block.blockName.toLowerCase();

                            console.log(`Number of items before filtering: ${items.length}`);
                            const filteredItems = this.filterMealItems(items, mealType, filters, itemTypeFilters, exactNameFilters, startsWithFilters);
                            console.log(`Number of items after filtering: ${filteredItems.length}`);

                            if (mealType === 'breakfast' && showBreakfast) {
                                breakfast = filteredItems.map(item => item.item_Name);
                            } else if (mealType === 'lunch' && showLunch) {
                                lunch = filteredItems.map(item => item.item_Name);
                            }
                        } else {
                            console.log(`No cafeteria line data for block: ${block.blockName}`);
                        }
                    });

                    // console.log(`Breakfast items: ${breakfast ? breakfast.join(', ') : 'Not shown'}`);
                    // console.log(`Lunch items: ${lunch ? lunch.join(', ') : 'Not shown'}`);

                    // Only add the day if there's menu data to show
                    if ((showBreakfast && breakfast && breakfast.length > 0) || (showLunch && lunch && lunch.length > 0)) {
                        mealData.push({
                            date: formattedDate,
                            breakfast: breakfast ? breakfast.join(", ") : null,
                            lunch: lunch ? lunch.join(", ") : null
                        });
                        console.log(`Adding day to mealData: ${formattedDate}`);
                    } else {
                        console.log(`Skipping day with no menu data to show: ${formattedDate}`);
                    }
                }
            } else {
                console.log(`Skipping past day: ${formattedDate}`);
            }
        });

        console.log(`Total days in mealData: ${mealData.length}`);
        return mealData;
    },

    filterMealItems: function (items, mealType, filters, itemTypeFilters, exactNameFilters, startsWithFilters) {
        return items.filter(item => {
            const mealFilters = filters[mealType] || [];
            const mealItemTypeFilters = itemTypeFilters[mealType] || [];
            const mealExactNameFilters = exactNameFilters[mealType] || [];
            const mealStartsWithFilters = startsWithFilters[mealType] || [];

            // Check if the item name contains any of the filtered words
            const nameFilter = !mealFilters.some(filter =>
                item.item_Name.toLowerCase().includes(filter.toLowerCase())
            );

            // Check if the item type is in the filtered types
            const typeFilter = !mealItemTypeFilters.includes(item.item_Type);

            // Check if the item name exactly matches any of the exact name filters
            const exactNameFilter = !mealExactNameFilters.includes(item.item_Name);

            // Check if the item name starts with any of the starts with filters
            const startsWithFilter = !mealStartsWithFilters.some(filter =>
                item.item_Name.toLowerCase().startsWith(filter.toLowerCase())
            );

            return nameFilter && typeFilter && exactNameFilter && startsWithFilter;
        });
    },

    writeDataToFile: function (data, filename) {
        const filePath = path.join(__dirname, filename);
        fs.writeFile(filePath, JSON.stringify(data, null, 2), (err) => {
            if (err) {
                console.error(`Error writing data to ${filename}:`, err);
            } else {
                console.log(`Data written to file: ${filePath}`);
            }
        });
    }
});