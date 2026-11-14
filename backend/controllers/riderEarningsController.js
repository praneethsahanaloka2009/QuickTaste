import riderEarningsSettingsModel from "../models/riderEarningsSettingsModel.js";

// Get Rider Earnings Settings — Admin Only
const getRiderEarningsSettings = async (req, res) => {
    try {
        const settings = await riderEarningsSettingsModel.findOne({key: "global"});

        return res.status(200).json({
            success: true,
            settings: {
                defaultEarning: settings?.defaultEarning ?? 2,
                currency: settings?.currency ?? "USD",
                updatedAt: settings?.updatedAt ?? null
            }
        });

    } catch (error) {
        console.error("Get Rider Earnings Settings Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to load rider earnings settings."
        });
    }
};

// Update Rider Earnings Settings — Admin Only
const updateRiderEarningsSettings = async (req, res) => {
    try {
        const { defaultEarning } = req.body;

        if(typeof defaultEarning !== "number" || !Number.isFinite(defaultEarning) || defaultEarning < 0 || !Number.isInteger(defaultEarning * 100)){
            return res.status(400).json({
                success: false,
                message: "Enter a valid earning amount with up to 2 decimal places."
            });
        }

        const settings = await riderEarningsSettingsModel.findOneAndUpdate(
            {
                key: "global" 
            },
            {
                $set: {
                    defaultEarning,
                    updatedBy: req.adminId
                },
                $setOnInsert: {
                    key: "global",
                    currency: "USD"
                }
            },
            {
                upsert: true,
                returnDocument: "after",
                runValidators: true
            }
        );

        return res.status(200).json({
            success: true,
            message: "Rider earnings settings updated successfully.",
            settings: {
                defaultEarning: settings.defaultEarning,
                currency: settings.currency,
                updatedAt: settings.updatedAt
            }
        });
    } catch (error) {
        console.error("Update Rider Earnings Settings Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update rider earnings settings."
        });
    }
};

export {getRiderEarningsSettings, updateRiderEarningsSettings};