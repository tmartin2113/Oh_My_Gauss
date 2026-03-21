package dev.cortexos.mcp.servers.contacts

import android.content.Context
import android.provider.ContactsContract
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

data class Contact(
    val id: String,
    val displayName: String,
    val phoneNumbers: List<PhoneEntry>
)

data class PhoneEntry(
    val number: String,
    val label: String   // "Mobile", "Home", "Work", etc.
)

@Singleton
class ContactsRepository @Inject constructor(
    @ApplicationContext private val context: Context
) {

    /**
     * Searches contacts whose display name or any phone number contains [query].
     * Results are deduplicated by contact ID so a contact with multiple numbers
     * appears once with all its numbers listed.
     *
     * @param query Case-insensitive substring match.
     * @param limit Maximum number of distinct contacts to return.
     */
    suspend fun search(query: String, limit: Int = 10): List<Contact> =
        withContext(Dispatchers.IO) {
            val uri        = ContactsContract.CommonDataKinds.Phone.CONTENT_URI
            val projection = arrayOf(
                ContactsContract.CommonDataKinds.Phone.CONTACT_ID,
                ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME_PRIMARY,
                ContactsContract.CommonDataKinds.Phone.NUMBER,
                ContactsContract.CommonDataKinds.Phone.TYPE,
                ContactsContract.CommonDataKinds.Phone.LABEL
            )
            val selection = (
                "${ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME_PRIMARY} LIKE ? OR " +
                "${ContactsContract.CommonDataKinds.Phone.NORMALIZED_NUMBER} LIKE ?"
            )
            val args  = arrayOf("%$query%", "%$query%")
            val order = "${ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME_PRIMARY} ASC"

            val grouped = mutableMapOf<String, MutableList<PhoneEntry>>()
            val nameMap = mutableMapOf<String, String>()

            context.contentResolver.query(uri, projection, selection, args, order)
                ?.use { cursor ->
                    val idCol   = cursor.getColumnIndexOrThrow(ContactsContract.CommonDataKinds.Phone.CONTACT_ID)
                    val nameCol = cursor.getColumnIndexOrThrow(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME_PRIMARY)
                    val numCol  = cursor.getColumnIndexOrThrow(ContactsContract.CommonDataKinds.Phone.NUMBER)
                    val typeCol = cursor.getColumnIndexOrThrow(ContactsContract.CommonDataKinds.Phone.TYPE)
                    val lblCol  = cursor.getColumnIndexOrThrow(ContactsContract.CommonDataKinds.Phone.LABEL)

                    while (cursor.moveToNext() && grouped.size < limit) {
                        val id   = cursor.getString(idCol)
                        val name = cursor.getString(nameCol) ?: continue
                        val num  = cursor.getString(numCol) ?: continue
                        val type = cursor.getInt(typeCol)
                        val lbl  = cursor.getString(lblCol)

                        nameMap[id] = name
                        grouped.getOrPut(id) { mutableListOf() }.add(
                            PhoneEntry(
                                number = num,
                                label  = ContactsContract.CommonDataKinds.Phone.getTypeLabel(
                                    context.resources, type, lbl
                                ).toString()
                            )
                        )
                    }
                }

            grouped.entries.take(limit).map { (id, phones) ->
                Contact(
                    id           = id,
                    displayName  = nameMap[id] ?: "Unknown",
                    phoneNumbers = phones
                )
            }
        }

    /**
     * Returns all phone numbers for a specific contact ID.
     * Useful after a search to get the full details for a single contact.
     */
    suspend fun getById(contactId: String): Contact? =
        withContext(Dispatchers.IO) {
            val uri        = ContactsContract.CommonDataKinds.Phone.CONTENT_URI
            val projection = arrayOf(
                ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME_PRIMARY,
                ContactsContract.CommonDataKinds.Phone.NUMBER,
                ContactsContract.CommonDataKinds.Phone.TYPE,
                ContactsContract.CommonDataKinds.Phone.LABEL
            )
            val selection = "${ContactsContract.CommonDataKinds.Phone.CONTACT_ID} = ?"
            val args      = arrayOf(contactId)

            val phones = mutableListOf<PhoneEntry>()
            var name: String? = null

            context.contentResolver.query(uri, projection, selection, args, null)
                ?.use { cursor ->
                    val nameCol = cursor.getColumnIndexOrThrow(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME_PRIMARY)
                    val numCol  = cursor.getColumnIndexOrThrow(ContactsContract.CommonDataKinds.Phone.NUMBER)
                    val typeCol = cursor.getColumnIndexOrThrow(ContactsContract.CommonDataKinds.Phone.TYPE)
                    val lblCol  = cursor.getColumnIndexOrThrow(ContactsContract.CommonDataKinds.Phone.LABEL)

                    while (cursor.moveToNext()) {
                        if (name == null) name = cursor.getString(nameCol)
                        val num  = cursor.getString(numCol) ?: continue
                        val type = cursor.getInt(typeCol)
                        val lbl  = cursor.getString(lblCol)
                        phones.add(
                            PhoneEntry(
                                number = num,
                                label  = ContactsContract.CommonDataKinds.Phone.getTypeLabel(
                                    context.resources, type, lbl
                                ).toString()
                            )
                        )
                    }
                }

            if (name == null) null
            else Contact(id = contactId, displayName = name!!, phoneNumbers = phones)
        }
}
